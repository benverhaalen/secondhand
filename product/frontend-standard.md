# Frontend standard: how every screen is built, judged and audited

Asked for by Ben on 2026-11-14 at 19:47 ([words](words.md#2026-11-14-frontend-standard)). It sits under the [UI constitution](ui-constitution.md) and extends the decided UI principles in [copy.md](copy.md): show, don't say; the anti-claudish writing pass; familiar patterns; attention on purpose. The references behind each rule, with their evidence marks, are in [research/cross-cutting/ben/frontend-references.md](../research/cross-cutting/ben/frontend-references.md). Values live in [brand/tokens.css](../brand/tokens.css); this file says when and why to use them.

Status: the four principles are Decided. Every concrete rule below is an *agent proposal* until Ben or Nate changes or accepts it. Where a source gives a number, the number is the source's, not ours.

Precedence when rules conflict: Ben's decisions, then accessibility, then this standard, then the brand codes, then taste.

## 1. Judge: the order of questions for any screen

Ask these in order. A later question never rescues an earlier failure.

1. **Job.** What is the one thing this screen is for, and what is the next action? If you can't say it in one sentence, stop and fix the screen's job, not its look.
2. **Familiar.** Which app the user already knows does this job, and what do we keep from it? (Jakob's law.) If none, the pattern needs a written reason.
3. **Shown, not said.** Cover all the text. Can you still tell the item's state and the next action from photos, pills, badges, numbers and position?
4. **Attention.** Blur or squint. The first thing you see is the thing that matters most; the second is the next action. One primary action per decision. Whatever acts looks pressable and nothing else does (§5).
5. **Honest.** Every number has a source, every automatic action is labelled and undoable, nothing invented, no fake urgency.
6. **Motion.** Does anything move? Each movement must explain a cause and effect the user would otherwise miss. Otherwise delete it.
7. **Words.** Run the anti-claudish pass: `node scripts/copy-lint.mjs` (C1 to C12 in copy.md). Labels 1 to 3 words, no paragraphs, no em dashes.
8. **Access.** Contrast, target size, Dynamic Type, VoiceOver labels, reduced motion.

## 2. Build: the loop

This is [Ben's loop](words.md#2026-11-14-the-ui-loop) as twelve states, tailored from his ui-factory skill. Each state says what happens and where it goes next. Any state can ask one research question with a time limit when it is unsure (the `research-note` skill), and comes back to where it was.

**Size the work first.** The size is set by what a mistake costs and how often the screen is seen, and it sets how much of the loop runs.

| Size | Examples | Image rounds | Who judges | States it runs |
|---|---|---|---|---|
| Small | A 404, an empty state, a settings row, a state of a screen that exists | None | Scripts | 1, then 7 to 12 |
| Medium | A new screen made mostly of parts that exist | One round of 3: two open, one steered | The model | All but 6 |
| Large | Today, the Sell grid, Capture, the Offer sheet, a section of the web front page | Up to 3 rounds of 4: two open, two steered | The model, then Ben | All |

| State | What happens | Next |
|---|---|---|
| 1. Triage | Size the work from the table above. | Small goes to 7. Otherwise 2. |
| 2. Frame | Write who it is for, how often they come, what they came to do and where a mistake costs most. Say what they want, as opposed to what they would say ([Article 2.1](ui-constitution.md#article-2-start-from-the-person-not-the-screen)). | 3 |
| 3. In the family? | List the parts in [app/src/ui](../app/src/ui/README.md), the patterns and the decisions that already cover this screen, and what is fixed around it: the tab bar, the header, the screens it sits between. A control that the Vercel UI SDK or shadcn already has is decided. | If the parts that exist can build it, 7, with no image. Otherwise 4. |
| 4. Explore, 2 to 4 ways | Each design comes from its own fresh call through the [`image-gen` skill](../.agents/skills/image-gen/SKILL.md), in parallel. Every call gets the intention, the fixed surroundings as images, feel references, how it will be judged and what not to do. Two calls get nothing more. Each of the others also gets one lever to push as far as it goes, from the table below. No call gets a layout, copy, numbers or another design. | 5 |
| 5. Judge and split | A fresh judge gets the images, the intention and the fail list from `node scripts/ui-rules.mjs judge`, written before it looks. Sort every finding: an exact fix (a size, a gap, a color) is saved for the build and never sent back to the image model. A feel note goes into the next round. | New feel notes: 4, with 2 or 3 designs, 3 rounds at most. Otherwise the best so far, not the latest, moves on. |
| 6. Ben reacts | Large only. Ben sees the best one or two. A model is a weak judge of taste, so his reaction replaces a third round. | Pick: 7. Redirect: 2. |
| 7. Static build | Recreate the image as a still screen with sample content, in the smallest change that fits, from the parts and the brand values. Read the [coder card](../brand/coder-card.md). Apply the saved exact fixes. A part that is missing is added to app/src/ui with its reason. | 8 |
| 8. Behavior table | A fresh agent that has not seen the code looks at the still screen and writes `app/behavior/<screen>.json`: what each state shows, what each control does on tap and where Back goes. A control that leads to a screen that doesn't exist queues that screen at 1. | 9 |
| 9. Tests first | An agent that is not the builder turns the table into tests that fail. The app's tests are Maestro files, explored once with agent-device ([decision](decisions.md)); the website's are Playwright. Tests read the event log, not pixels. The builder edits neither the table nor the tests. | 10 |
| 10. Add behavior | Make the tests pass. Take motion and haptics from §3 for each kind of transition. A transition with no standard gets one, written once in §3. | 11 |
| 11. Check | `node .agents/check.mjs`, then §5 on the screen at 390×844. A fresh agent compares the build with the chosen image and calls each difference intended, a substitution or drift. Large screens also get worst-case content (Empty, One, Huge) and a motion review. | Pass: 12. Fail: 10, stopping after two rounds with no progress. |
| 12. Record | New parts go in app/src/ui, new motion standards in §3. Every finding from a judge, an audit or Ben goes through §7, so the next screen is checked for it. | Done |

A beautiful screen with a dead control fails. So does a working screen that drifts from the chosen look.

### Levers for the steered designs

Ben: two designs "not specifically prompted to look a certain way", and the others told "to maximize different levers" ([words](words.md#2026-11-15-a-brand-system-for-anything-alive-and-bold-with-purpose-code-that-knows-each-app-and-knowing-when-things-sell)). The list is an *agent proposal* from [bold-and-alive.md](../research/cross-cutting/ben/bold-and-alive.md). One lever per design, never two. Each names a change in structure, because a model answers an adjective with decoration.

| Lever | The line the call gets | It must keep | Use on |
|---|---|---|---|
| One departure | Break from how apps of this kind do this in one way you can name, and say what the break is for | Everything else conventional | App and site |
| One thing | Give one element nearly all the size, color and contrast | Every action, made smaller, not removed | App and site |
| Hands on it | Let the person act on the item itself: drag, swipe or pinch | A tap that does the same | App |
| Photo as hero | The item photo takes most of the screen and everything else shrinks to fit it | The price and the next action in view | App and site |
| Brand signature | With the name covered it could only be secondhand: the gradient, Clofie and the hues are structure, not decoration | Photos untinted and first | App and site |
| First action | The main action is reachable at first glance, with no scroll | What the person needs to trust it | App |
| Alive | The still frame shows what moves and why | Nothing delays reading or the first tap | Site |

Pick the levers the screen's job points at: the Sell grid suits photo as hero, an offer suits first action, the site's front page suits alive and one departure. "One departure" is where boldness and innovation live. Its test is the bold-move lines in the judge's list (rules Q1 to Q5): one named departure, a purpose, ownable with the name covered, one per view, and it never breaks legibility or a familiar control.

## 3. Motion

Sources: Apple HIG Motion, NN/g on animation duration, Emil Kowalski's animation guidance and review-animations skill, and the Vercel Web Interface Guidelines. All are in the research note.

### Rules

- **Purpose or nothing.** "Don't add motion for the sake of adding motion" (Apple HIG). Motion is allowed only for:
  - feedback on a touch
  - showing where something came from or went
  - showing that state changed
  - showing progress
  - telling the story of what the product does (the signed-out site)
  - recognition: the one signature motion, the gradient's drift
- **Named, with its reason.** Every motion in the app is a row in [app/src/ui/motion.ts](../app/src/ui/motion.ts) with one of these six reasons and a duration from the tokens. A raw duration in a screen fails the check.
- **The signed-out site is alive.** The product's own flow plays as the hero, in code. The gradient drifts with a meaning. Sections reveal once. The moves, each with its purpose and where it backfires, are in [bold-and-alive.md](../research/cross-cutting/ben/bold-and-alive.md#what-makes-the-signed-out-site-alive).
- **Frequency sets the budget.** Actions done many times a day (switching tabs, scrolling the grid, typing) get no custom animation. Actions done tens of times a day get a short, subtle one. Rare moments (a sale, a first post) may take longer (Emil, NN/g, HIG).
- **Duration.**
  - Feedback: about 100 to 150 ms.
  - Selection and small moves: about 200 ms.
  - Sheets and screen changes: 200 to 300 ms entering, a little faster leaving.
  - Nothing in the UI reaches 500 ms ("feels like a real drag", NN/g).
  - Tokens: `--t-feedback 150ms`, `--t-select 200ms`, `--t-panel 300ms`.
- **Easing.** Ease-out for anything entering or responding (`--ease-out`). No `ease-in` on UI. Never linear except for progress bars.
- **Origin.** Things grow from what you touched: popovers and menus from their trigger, and a captured photo flies to its slot in the shot strip. Never scale from 0; start at 0.95 to 0.97 with opacity.
- **Interruptible.** Every animation can be cancelled by the next touch. Never make the user wait for one to finish (HIG, Vercel).
- **Cheap to render.** Animate `transform` and `opacity` only. Never `transition: all`.
- **Optional.** Under Reduce Motion, movement becomes a crossfade or an instant change. No information lives only in motion; haptics and the end state carry it too (HIG).
- **Loading.**
  - Show nothing for the first ~150 to 300 ms. Once shown, keep it at least ~300 to 500 ms so it doesn't flash (Vercel).
  - Skeletons mirror the final layout exactly.
  - Long work (researching an item) shows real progress: fields filling in, not a spinner.

### secondhand's motion moments

What each moment is built with in the Expo app, and how tap-to-show time is measured, is in [motion-and-speed.md](../research/cross-cutting/ben/motion-and-speed.md). Continuity is for the same object on both screens; when the next screen is a different thing, it pushes in the usual way.

Each moment names its borrowed pattern, its timing and its fallback.

| Moment | How often | Motion | Borrowed from | Reduce Motion |
|---|---|---|---|---|
| Tap a button or pill | Constant | Scales to 0.97 the moment the finger lands and springs back on release, so a second touch carries on from where it is. A light haptic only when the press commits something | iOS system buttons | Opacity dip |
| Open an item from a grid or a row | Many per day | The photo grows into the item page and shrinks back on return. The page shows what the tile already knew and fills in the rest | Apple Photos, App Store cards | Crossfade |
| Switch tabs | Constant | None; the content swaps | iOS tab bar | Same |
| Open all messages (chat icon, top right) | Several per day | Pushes in from the right like any iOS navigation, `--t-panel`; unread count crossfades | iOS navigation push; eBay and Marketplace header icon | Instant |
| Open New (Sell this / What's it worth / Find this) | Daily | The 56 circle's ＋ turns to ×, a scrim fades in, and the three choices rise from the button 30 ms apart, `--t-select`. Sell this opens the camera out of the button's circle, `--t-panel` ([Ben, 02:46](words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready), [note §5](../research/cross-cutting/ben/buttons-taps-corners-new-camera.md#5-new-then-the-camera)) | Floating action menus; the iOS camera opening from its button | Choices and camera fade in |
| The camera reads the item | Once per item | Corner brackets hold the item; a line in the field colors sweeps only while the work runs; each fact lands as a chip with a check as it resolves, and a fact not found yet is a blank chip; the caption names the real comparison | ID and face scanners | No sweep; chips appear |
| Take a shot in the guided capture | Tens per item | Shutter blink, then the thumbnail flies to its slot in the shot strip (origin-aware), ~250 ms. The next shot's outline appears. Light haptic | iOS Camera thumbnail | Thumbnail appears in place |
| Researching | Once per item | Fields fill in as each resolves, a 30 to 80 ms stagger, one thin progress line; no spinner after the first second | Skeleton screens (Vercel rule); live build logs | Fields appear |
| Approve a Today card | Many per day | Card collapses and the list closes the gap, `--t-select`; an Undo toast holds ~5 s | Gmail archive with Undo | Card disappears; toast stays |
| Item changes state (Draft→Live, Live→Sold) | Several per day | The tile moves to its new shelf (a FLIP via transform) and its pill crossfades | Photos and Reminders reorder | Pill changes; tile appears in the new shelf |
| It sold | Rare, the peak | Tile settles into Sold, the field fills the screen once, success haptic and sound. No confetti or counters (brand C2, C6) | Apple Pay check and haptic | Haptic only |
| Something failed | Rare | Red ✕ badge fades in once, warning haptic. No shaking or looping | iOS failed iMessage "Not Delivered" | Badge only |
| Auto action done | Many per day | None. A quiet `AUTO` label and Undo in the log | Gmail "Sent. Undo" | Same |
| Offer arrives (push) | Several per day | System notification; in app the card inserts at the top, `--t-select` | iMessage new message | Instant insert |

### Layout

Screens are built from the fixed parts in [app/src/ui](../app/src/ui/README.md), which also says which separator means what. `node .agents/check.mjs` fails a screen that lays itself out by hand.

## 4. States every screen must design

Each screen is audited in all of these (Vercel guidelines; IAE "plausible extreme content"). A script holds the list in [.agents/ui-states.json](../.agents/ui-states.json) with the extreme content to try, and `node scripts/brand-check.mjs` fails a mock that names its screen and leaves a state out (brand checks B34 and B35):

- **Empty:** why it's empty, plus the one action that fills it.
- **One item.**
- **Typical.**
- **Dense:** 40 items from a folder drop.
- **Loading:** see the rules in §3.
- **Job in flight** (Ben, 21:14: "since this is an agentic app i expect for you with the ui to be able to understand loading"). Most work here is a cloud job or API call that returns later: pricing, studio photos, posting, a reply being drafted. For every such job design four moments. *Agent proposal* for the details:
  - **Started:** the thing appears at once in its final place (the tile, the card, the field), marked as working. The tap never waits on the network.
  - **Running:** say what is running in two or three words ("Pricing on eBay"), and show partial results as they land. The user can leave the screen; the job keeps going and the tile or card carries the state.
  - **Arrived:** the result fills in where the placeholder was, without moving anything else. If the user was elsewhere, Today or the tile shows it.
  - **Failed or slow:** past its expected time, say so and keep the rest usable. On failure, name what failed and offer `Retry`. Other jobs on the same item carry on.
- **Error:** what failed and the one fix.
- **Offline.**
- **Long content:** a 90-character title, a $12,450.00 price, a long German brand name.
- **Largest Dynamic Type.**

Use real or realistic content, never lorem ipsum and never invented numbers presented as data.

## 5. Audit checklist

Run it on the rendered screen, not the code. A **Block** must be fixed before the screen counts as done. A **Flag** is a question that needs a reason written down.

### Job and familiarity
- [ ] Block: the screen's job and next action fit in one sentence.
- [ ] Block: one primary action per decision (at most one per card), black and in thumb reach. Destructive actions are never primary.
- [ ] Flag: the borrowed app is named in the screen's contract. Any custom gesture has a visible fallback.
- [ ] Block: whatever acts looks pressable, and nothing else does. Buttons take the styles of brand C4 and L5. A row or notice that opens a screen ends in a chevron (Apple's disclosure indicator). A decision card that opens its item takes the depth of brand Art. 9 and the whole card is its target; grid tiles keep their own rule (L12). Tags, counts and countdowns are flat. A dismiss X is never the only control on something that needs an action ([Ben, 02:18](words.md#2026-11-15-dark-mode-approved-the-size-system-everywhere-clickability-money-and-countdowns-color-blind-checks), [note §5](../research/today/ben/today-wants-alerts-and-clickability.md#5-clickability)).

### Show, don't say
- [ ] Block: the cover-the-text test passes (state and next action still readable).
- [ ] Block: no sentence explains something a pill, badge, number or photo already shows.
- [ ] Flag: more than one sentence on a card.
- [ ] Block: a decision card names what it is about before its title, with a tag: a word and an icon ("Offer", "Sold"). Which color each kind's tag takes is open in the brand ledger. A deadline sits on the card whose buttons meet it, never in a banner of its own ([note §2](../research/today/ben/today-wants-alerts-and-clickability.md#2-what-today-shows-in-order)).
- [ ] Flag: in a card's detail line only the money the person keeps is in ink; the rest is secondary ink. Weight stays Book (medium is for buttons, brand Art. 6).

### Attention
- [ ] Block: the blur test passes (focal point first, next action second).
- [ ] Block: color appears only as state fills, one field and the brick alert (brand constitution Art. 5, C2, C6).
- [ ] Flag: more than three actions visible on a card. Choice overload is conditional ([psychology §3](../research/cross-cutting/ben/psychology.md)), so justify it rather than ban it.
- [ ] Block: nothing sits in a corner's curve. In a box with radius r and padding p, content in a corner keeps p from the arc only at an inset x ≥ r − (r − p)/√2, measured on the ink, not the line box. On a decision card a top-right countdown sits 24 from the right edge. Shapes concentric with the box (the photo, radius r − p) already hold ([Ben, 02:46](words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready), [note §1](../research/cross-cutting/ben/buttons-taps-corners-new-camera.md#1-where-content-sits-in-a-rounded-corner)).
- [ ] Block: the same kind of thing looks the same everywhere. An item is a photo tile, a decision is a card with buttons, a platform is its logo.

### Honesty
- [ ] Block: every number is said in plain words a first-time user understands ("Similar jackets sold for $36 to $52 lately"), with the source one tap away. No `n=`, no unexplained terms such as "floor" or "comps".
- [ ] Block: every element has a row in the screen's reason table ([ui-constitution.md Article 1](ui-constitution.md#article-1-extreme-intention-every-element-has-a-stated-reason)).
- [ ] Block: every item shown has its photo.
- [ ] Block: each decision card names its full action set (primary, secondary, and More for the rest) and what happens if ignored.
- [ ] Block: platforms appear as their real logos (in a white bubble on photos, bare elsewhere), never as written names or letter badges like e / D / M. Use `assets/platforms/`. Logos follow each brand's guidelines: unaltered colors and proportions, minimum size.
- [ ] Block: every automatic action is labelled `AUTO` and can be undone.
- [ ] Block: no fake scarcity, guilt copy, confirmshaming or variable rewards ([psychology §9](../research/cross-cutting/ben/psychology.md)). A countdown shows only a deadline the card's data carries: an offer or listing expiry from the site, a ship-by date, a pickup time, or the Decision's own expiry ([spec](../spec/features/today.md)). Time left under 24 hours ("3h 40m", by the minute), a day and time beyond that, in secondary ink, never red, nothing that pulses ([Ben, 02:18](words.md#2026-11-15-dark-mode-approved-the-size-system-everywhere-clickability-money-and-countdowns-color-blind-checks), [note §4](../research/today/ben/today-wants-alerts-and-clickability.md#4-countdowns)).
- [ ] Block: destructive or outward actions (post, delist, send an address) need a confirmation or an undo window. Never-alone actions always need the tap.

### Words (anti-claudish)
- [ ] Block: `node scripts/copy-lint.mjs` hits are each fixed or justified (C1 to C12 in copy.md).
- [ ] Block: no em dashes, no exclamation marks, no emoji in the UI.
- [ ] Block: buttons are a verb plus an object, and labels are 1 to 3 words.

### Motion
- [ ] Block: each animation is justified by one of the four purposes in §3.
- [ ] Block: no animation on constant actions such as tabs, scrolling or typing.
- [ ] Block: durations stay within §3 and nothing in the UI reaches 500 ms.
- [ ] Block: no `transition: all`, no `scale(0)`, no `ease-in` on UI, and only `transform` and `opacity` are animated.
- [ ] Block: every animation is interruptible, and the Reduce Motion variant exists and was checked.
- [ ] Block: every cloud job on the screen has its started, running, arrived and failed moments designed (§4).
- [ ] Block: no loading flash (show delay and minimum time); skeletons match the final layout.

### Access
- [ ] Block: text contrast is at least 4.5:1 (WCAG 2.2 AA), and 3:1 for large text and UI parts. Field, state and category colors are never text on white (brand Art. 5.1).
- [ ] Block: a button's size follows its kind, never its words. A pill is 40 tall and hugs its label with 20 a side, at least 88 wide; the copy limit is its ceiling. A full-width primary is the content width by 48, one per screen. An icon button is a 40 circle; New is 56. Every target's hit area is at least 44 by 44: it grows into free space around a small control, and between two close targets the gap is split down the middle so no point belongs to both (Apple HIG; [Ben, 02:46](words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready); [note §2 and §3](../research/cross-cutting/ben/buttons-taps-corners-new-camera.md#2-button-sizes)).
- [ ] Block: inputs are at least 16 px, which prevents iOS zoom.
- [ ] Block: VoiceOver labels exist on icon-only controls and state pills, and a pill reads as "Live on eBay", not "green dot".
- [ ] Block: the layout holds at the largest Dynamic Type size.
- [ ] Block: state follows brand Art. 5's States rule (a word or an icon, never color alone). No dark ground has OKLCH hue 70 to 115 with L under .5: it reads brown.
- [ ] Flag: renders checked under simulated protanopia and deuteranopia (Machado 2009), with two state colors in one view at least .056 apart in Oklab. Ben is color blind but asked that it not weigh too much ([02:18](words.md#2026-11-15-dark-mode-approved-the-size-system-everywhere-clickability-money-and-countdowns-color-blind-checks), [note §6](../research/today/ben/today-wants-alerts-and-clickability.md#6-color-blindness); [02:59](words.md#2026-11-15-color-blindness-weighed-lightly): "dont weight to colorblindness too much"), so a near pair is a reason to write down, not a stop.

### Character
- [ ] Block: tokens only, with the real fonts and Hugeicons rendered. The check is on the rendered result, not the CSS.
- [ ] Block: a side-by-side with the selected image is done, and every mismatch is classified as intended, substitution or drift.
- [ ] Flag: a fresh-context critic reviewed the screen. If not, say the review wasn't independent.

## 6. Transfer contract template (one row per borrowed property)

| Property | Reference and its job | Keep (invariant) | Change (the 3%) | Check |
|---|---|---|---|---|
| Example: offer response | eBay offers (interaction) | Accept / Counter / Decline, with counter pre-filled | The comps range sits beside the offer, and Counter is pre-filled from your floor | A user answers an offer in one tap without opening the item |

## 7. Enforcement, and how the rule set learns

Ben: "deterministic ways to assess adherence to certain rules whether its like a lint rule or something but getting the system to essentially 'learn'" ([words](words.md#2026-11-15-the-ui-system-learns-with-checks-for-its-rules)).

**One list.** [.agents/ui-rules.json](../.agents/ui-rules.json) has a row for every pick Ben locked in the [brand ledger](../brand/ledger.md) and every rule of the loop. Each row says what holds the rule:

| Kind | Held by | Costs |
|---|---|---|
| `check` | A script in `.agents/checks/` or a test, shown failing on what it exists to catch. Two rules of the image loop are held by the image runner, which refuses a bad plan when it is used | Nothing. It runs on every push |
| `judge` | One "Fail if" line. `node scripts/ui-rules.mjs judge` prints them all, and only the judge reads them | One line in one prompt |
| `ben` | Ben's eye | His attention |

`node .agents/check.mjs` prints the count of each kind. The share held by a script is the number to push up.

**How a new rule gets in.**

| What came up | When it becomes a rule | What it becomes |
|---|---|---|
| Ben picks or corrects something | The same commit that records it. A locked row in the ledger with no row in the list fails the check | Whichever kind can hold it, a script first |
| A script could find it: a banned word, a value outside the set, a part not from app/src/ui | The first time | A check in [picks.mjs](../.agents/checks/picks.mjs), keyed by the rule's id, with a test named `picks <id>:` |
| Only a judge could find it | The second time. Note the first with `node scripts/ui-rules.mjs seen "<finding>" <where>`. A finding noted twice fails the check until it is a rule | A `judge` row whose line could fail a screen. "Arrows sit at the right edge of a row that opens a screen" is one. "Use arrows well" is not |
| Taste about look or feel | When Ben says it | A do and a don't picture in `brand/reference/`, once that exists ([image-gen step 9](../.agents/skills/image-gen/SKILL.md)) |

A rule leaves the list when removing it does not bring the mistake back, or when it keeps failing good work.

**What scripts hold today.** Raw colors, literal fonts and the copy lint ([ui.mjs](../.agents/checks/ui.mjs)). The weight, space and radius scales ([brand.mjs](../.agents/checks/brand.mjs)). Screens built only from the fixed parts ([parts.mjs](../.agents/checks/parts.mjs)). The picks in picks.mjs: the name in lowercase, logos not names, no banned faces, no statistics notation, no handled counter, a fill and an icon for every state, square logos, no lines or grain, dark mode that changes only color, ink that is not pure black, one color family, text contrast on every hue's tint, fill and deep, a behavior table for every screen, and motion that is named with a reason, honors Reduce Motion and never listens to scroll.

**What a script holds on the rendered output.** Anything written as HTML (a mock, the website, a deck, a post) goes through `node scripts/brand-check.mjs <file> --medium <medium>`, which measures the page in a browser: faces, sizes, colors against tokens, contrast, one field per view, color under a third of the view, margins, words per view, and one size for things of one kind (constitution Part IV). `node scripts/ui-rules.mjs judge <medium>` prints the judge's lines for that medium.

**What they can't hold yet.** The app's own screens on a device, until they render in a test: inside tighter than between, small targets, overflow. They stay with the §5 audit. Words in the app also pass `node scripts/copy-lint.mjs`, which flags candidates, not verdicts. Scripts can't prove a screen looks good; brand feel goes to Ben.
