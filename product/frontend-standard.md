# Frontend standard: how every screen is built, judged and audited

Asked for by Ben on 2026-11-14 at 19:47 ([words](words.md#2026-11-14-frontend-standard)). It sits under the [UI constitution](ui-constitution.md) and extends the decided UI principles in [copy.md](copy.md): show, don't say; the anti-claudish writing pass; familiar patterns; attention on purpose. The references behind each rule, with their evidence marks, are in [research/cross-cutting/ben/frontend-references.md](../research/cross-cutting/ben/frontend-references.md). Values live in [brand/tokens.css](../brand/tokens.css); this file says when and why to use them.

Status: the four principles are Decided. Every concrete rule below is an *agent proposal* until Ben or Nate changes or accepts it. Where a source gives a number, the number is the source's, not ours.

Precedence when rules conflict: Ben's decisions, then accessibility, then this standard, then the brand codes, then taste.

## 1. Judge: the order of questions for any screen

Ask these in order. A later question never rescues an earlier failure.

1. **Job.** What is the one thing this screen is for, and what is the next action? If you can't say it in one sentence, stop and fix the screen's job, not its look.
2. **Familiar.** Which app the user already knows does this job, and what do we keep from it? (Jakob's law.) If none, the pattern needs a written reason.
3. **Shown, not said.** Cover all the text. Can you still tell the item's state and the next action from photos, pills, badges, numbers and position?
4. **Attention.** Blur or squint. The first thing you see is the thing that matters most; the second is the next action. One primary action per decision.
5. **Honest.** Every number has a source, every automatic action is labelled and undoable, nothing invented, no fake urgency.
6. **Motion.** Does anything move? Each movement must explain a cause and effect the user would otherwise miss. Otherwise delete it.
7. **Words.** Run the anti-claudish pass: `node scripts/copy-lint.mjs` (C1 to C12 in copy.md). Labels 1 to 3 words, no paragraphs, no em dashes.
8. **Access.** Contrast, target size, Dynamic Type, VoiceOver labels, reduced motion.

## 2. Build: Ben's ui-factory, with the RDD loop inside it

Ben already has the process: his **ui-factory** skill (harness, on his Mac), built on the it-already-exists method ([ui-continuity](https://github.com/benverhaalen/it-already-exists/blob/main/skills/reference-driven-development/references/ui-continuity.md)) and Emil Kowalski's vendored skills. Agents with the harness run it. Agents without it (Nate's) follow this summary.

**Size by how much the agent would guess.** In his words, ideation is for "bigger screens where an agent has to infer more intent" and "shouldn't be done for every sub state".
- **Full:** a new surface, entry point or navigation level, for example Today, Sell grid, Buy, You, Capture and the Offer sheet.
- **Light:** a state of an existing screen, a settled component or a small fix. Light has no images, follows the code and runs the checks on the changed screens only.

**Every screen, both sizes:**
1. **Four screen lines.** Who the user is, how often they come, the main task, and the task with the worst consequence.
2. **Read the coder card** (`brand/coder-card.md`) and this standard.
3. **References with jobs.** Use real shipped screens, not AI galleries. One gives navigation, another density, another motion, another recovery. Write a transfer contract per borrowed property (§6).
4. **Full only: direction images.** Made with the `image-gen` skill (`.agents/skills/image-gen/SKILL.md`): the Codex CLI with Astra, the reference pixels attached, and a brief that gives the loop and how to judge rather than the content.
5. **Full only: fresh-context critique.** The critic sees the reference and candidate images but not the builder's rationale. It returns accept, revise or reject. Stop after two rounds with no new accepted finding and show the best candidate, not the latest.
6. **Full only: the door check, before building.** A fresh helper answers, as an expert designer, what each control does, where Back goes and what each state shows. Those answers become `checks/<screen>.transitions.json`, which a different helper turns into Playwright checks. The builder can't edit the table.
7. **Build.**
   - Use `var(--token)` only, with controls from the Vercel UI SDK where they exist.
   - Read Emil's `emil-design-eng` first.
   - Load the real fonts and Hugeicons, and confirm they rendered.
8. **Break it.** Emil's `break-ui` worst-case data behind a dev toggle: Demo, Worst case, Empty, One, Huge. Every state is captured. A state not captured is not verified.
9. **Audit** with §5 on the rendered screen at 390×844 and at the largest Dynamic Type size.
10. **Compare with the approved image.** A helper who is not the builder classifies each mismatch as intended adaptation, substitution or drift. Drift gets fixed.
11. **End with "usable" and the unfinished list.** Don't claim a skill ran if its file wasn't read.

The two contracts run at once:
- **Competence:** what the user can do, and the ordinary conventions of the task family.
- **Character:** hierarchy, density, type and motion.

A beautiful screen with a dead control fails competence. A working screen that drifts from the selected look fails character.

## 3. Motion

Sources: Apple HIG Motion, NN/g on animation duration, Emil Kowalski's animation guidance and review-animations skill, and the Vercel Web Interface Guidelines. All are in the research note.

### Rules

- **Purpose or nothing.** "Don't add motion for the sake of adding motion" (Apple HIG). Motion is allowed only for:
  - feedback on a touch
  - showing where something came from or went
  - showing that state changed
  - showing progress
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

Each moment names its borrowed pattern, its timing and its fallback.

| Moment | How often | Motion | Borrowed from | Reduce Motion |
|---|---|---|---|---|
| Tap a button or pill | Constant | Press to scale 0.97, `--t-feedback` | iOS system buttons | Opacity dip |
| Switch tabs | Constant | None; the content swaps | iOS tab bar | Same |
| Open all messages (chat icon, top right) | Several per day | Pushes in from the right like any iOS navigation, `--t-panel`; unread count crossfades | iOS navigation push; eBay and Marketplace header icon | Instant |
| Open ＋ (Sell this / What's it worth / Find this) | Daily | Sheet rises from the bottom, `--t-panel`, drag to dismiss | iOS sheet | Fade |
| Take a shot in the guided capture | Tens per item | Shutter blink, then the thumbnail flies to its slot in the shot strip (origin-aware), ~250 ms. The next shot's outline appears. Light haptic | iOS Camera thumbnail | Thumbnail appears in place |
| Researching | Once per item | Fields fill in as each resolves, a 30 to 80 ms stagger, one thin progress line; no spinner after the first second | Skeleton screens (Vercel rule); live build logs | Fields appear |
| Approve a Today card | Many per day | Card collapses and the list closes the gap, `--t-select`; an Undo toast holds ~5 s | Gmail archive with Undo | Card disappears; toast stays |
| Item changes state (Draft→Live, Live→Sold) | Several per day | The tile moves to its new shelf (a FLIP via transform) and its pill crossfades | Photos and Reminders reorder | Pill changes; tile appears in the new shelf |
| It sold | Rare, the peak | Tile settles into Sold, the field fills the screen once, success haptic and sound. No confetti or counters (brand C2, C6) | Apple Pay check and haptic | Haptic only |
| Something failed | Rare | Red ✕ badge fades in once, warning haptic. No shaking or looping | iOS failed iMessage "Not Delivered" | Badge only |
| Auto action done | Many per day | None. A quiet `AUTO` label and Undo in the log | Gmail "Sent. Undo" | Same |
| Offer arrives (push) | Several per day | System notification; in app the card inserts at the top, `--t-select` | iMessage new message | Instant insert |

## 4. States every screen must design

Each screen is audited in all of these (Vercel guidelines; IAE "plausible extreme content"):

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

### Show, don't say
- [ ] Block: the cover-the-text test passes (state and next action still readable).
- [ ] Block: no sentence explains something a pill, badge, number or photo already shows.
- [ ] Flag: more than one sentence on a card.

### Attention
- [ ] Block: the blur test passes (focal point first, next action second).
- [ ] Block: color appears only as state fills, one field and the brick alert (brand constitution Art. 5, C2, C6).
- [ ] Flag: more than three actions visible on a card. Choice overload is conditional ([psychology §3](../research/cross-cutting/ben/psychology.md)), so justify it rather than ban it.
- [ ] Block: the same kind of thing looks the same everywhere. An item is a photo tile, a decision is a card with buttons, a platform is its logo.

### Honesty
- [ ] Block: every number is said in plain words a first-time user understands ("Similar jackets sold for $36 to $52 lately"), with the source one tap away. No `n=`, no unexplained terms such as "floor" or "comps".
- [ ] Block: every element has a row in the screen's reason table ([ui-constitution.md Article 1](ui-constitution.md#article-1-extreme-intention-every-element-has-a-stated-reason)).
- [ ] Block: every item shown has its photo.
- [ ] Block: each decision card names its full action set (primary, secondary, and More for the rest) and what happens if ignored.
- [ ] Block: platforms appear as their real logos (in a white bubble on photos, bare elsewhere), never as written names or letter badges like e / D / M. Use `assets/platforms/`. Logos follow each brand's guidelines: unaltered colors and proportions, minimum size.
- [ ] Block: every automatic action is labelled `AUTO` and can be undone.
- [ ] Block: no fake scarcity, countdowns, guilt copy, confirmshaming or variable rewards ([psychology §9](../research/cross-cutting/ben/psychology.md)).
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
- [ ] Block: touch targets are at least 44 pt, and main buttons 48.
- [ ] Block: inputs are at least 16 px, which prevents iOS zoom.
- [ ] Block: VoiceOver labels exist on icon-only controls and state pills, and a pill reads as "Live on eBay", not "green dot".
- [ ] Block: the layout holds at the largest Dynamic Type size.

### Character
- [ ] Block: tokens only, with the real fonts and Hugeicons rendered. The check is on the rendered result, not the CSS.
- [ ] Block: a side-by-side with the selected image is done, and every mismatch is classified as intended, substitution or drift.
- [ ] Flag: a fresh-context critic reviewed the screen. If not, say the review wasn't independent.

## 6. Transfer contract template (one row per borrowed property)

| Property | Reference and its job | Keep (invariant) | Change (the 3%) | Check |
|---|---|---|---|---|
| Example: offer response | eBay offers (interaction) | Accept / Counter / Decline, with counter pre-filled | The comps range sits beside the offer, and Counter is pre-filled from your floor | A user answers an offer in one tap without opening the item |

## 7. Enforcement

- **Words in the app:** `node scripts/copy-lint.mjs <files>` (or pipe the screen's strings in). It is a port of the product-surface rules from Ben's `writing` skill, his anti-claudish check, plus a ban on exclamation marks. It flags candidates, not verdicts. First ask of each string "should this exist?", then lint.
- **Ben's hook:** on his Mac, `writing/hooks/reply_check.py` runs on Stop and UserPromptSubmit. It checks agents' replies to him (the owner surface), not screen text, and it never blocks. Screen text is checked only when ui-factory's check step runs the product lint. Nothing runs it automatically yet. *Agent proposal:* run `copy-lint` in CI on UI string files once the app exists.
- **Scripted checks (ui-factory step 6):** token membership; Vercel SDK controls; geometry (overflow, clipping, overlap, small targets) at each viewport and state; axe-core `wcag22aa`; brand codes present and Article 13 tells absent; and the copy lint.
- **Motion:** read Emil's `review-animations` and `STANDARDS.md` whenever a screen moves. The §5 motion items are written so Playwright can check most of them: computed `transition-property`, durations and a reduced-motion run.
- **What scripts can't prove:** that a screen looks good, that a token sits in the right place, or that a first-time user can learn it. Cover-the-text, blur and critique need eyes; brand feel goes to Ben. Record each result in `brand/screens/<screen>.run.md`.
