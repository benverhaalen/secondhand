# secondhand design review
Researched 2026-11-15 by Ben (Codex). Feature: cross-cutting.

The strongest direction is a shared frame around four different kinds of work: Today helps you finish what needs you; Sell helps you recognise and manage your things; Buy helps you find something worth buying; You helps you understand and control the arrangement. They should feel related through their navigation, typography, state meanings and interaction behavior. Their contents need different layouts.

The existing system has useful foundations: item photography, money after fees, restrained state colors, shared components and complete routes into detail. The main weakness is the translation from those parts into a whole experience. Some checks enforce geometry while missing task priority, content meaning and what survives navigation. More rules alone would repeat that problem.

This review distinguishes **observed** code or rendered output from **proposed** design judgments. The broader layouts below are proposals, not implemented screens or usability findings. The primary person remains someone clearing their own things who also buys used. Reseller volume is a stress test; it should not turn the product into a professional operations dashboard. [Product direction](../../../product/vision.md), [persona evidence](../../../product/personas.md).

**What has changed already**

The shared shell now puts the wordmark at the top left and messages at the top right, with a smaller page name beneath. The bottom capsule has icons without visible labels, all aligned with the central plus. Existing Clofie text renders lowercase; body text, item names and numbers keep their appropriate typeface. These changes were checked in real browser renders with phone insets, light and dark modes. Browser font inspection confirmed that the logo uses the loaded Clofie face and the page label uses PP Neue Montreal. They have not been validated on a native iPhone.

There is a deliberate tradeoff in the bottom bar. Apple recommends labels and reserves tab bars for destinations; your icon-only bar and central New action depart from that guidance. Keep your chosen direction, preserve accessible names and the visible page title, and test whether a first-time person can distinguish Sell from Buy. Calling it familiar does not establish that people understand the icons. [Apple’s tab-bar guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars.md).

**Today**

**Purpose:** Let someone return, resolve what genuinely needs their judgment, and leave confident that everything else is progressing.

Observed: the screen leads with a large money summary, then urgency groups of decision cards; lower-priority groups can stack. Each decision carries its action, alternatives and a path into context. That is a strong foundation. In the inspected render, the earnings region occupies substantial space before the first urgent decision. The headline also switches between recent earnings, a longer period, potential value and interest. My inference is that this can reward a visit while making it harder to tell what actually changed. Keep each metric’s meaning explicit and give urgent work earlier visual priority. [Today implementation](../../../app/src/app/%28tabs%29/index.tsx), [headline selection](../../../app/src/today/cards.ts).

| Layout | What the person experiences | Judgment |
|---|---|---|
| **1. Prioritized inbox** | Familiar mail/reminder rows grouped by urgency; the chosen task expands to show its complete decision. | **Recommended.** It exposes the workload and supports quick scanning. Keep enough context to act; a row of unexplained alerts would lose the advantage. |
| **2. Daily agenda** | A calendar-like sequence of commitments, with untimed decisions in a separate group. | Strong when pickups and shipping dominate. Weaker when several unrelated judgments matter more than their time. |
| **3. Focus queue** | One complete decision at a time, with the remaining queue visibly browsable. | Lowest immediate cognitive load, but can hide breadth. It must reveal urgent deadlines and allow jumping to another task. |

I would choose the inbox and retain a compact progress receipt. Keep the reward of seeing money earned without making someone pass it every time they return to finish a task.

**Sell**

**Purpose:** Give someone a dependable picture of their own things and enough control to move them toward the outcome they want.

Observed: the photo grid is grouped into state shelves, with filters for those same states, platform filters, sort and selection. Shelves preview items and offer See all; inactive groups can fold. This supports visual recognition. But Select occupies a separate mostly empty row, and state navigation appears twice. Filtering can produce an empty grid without explaining the selected scope. These are hierarchy and recovery issues, not reasons to shrink every component. [Sell implementation](../../../app/src/app/%28tabs%29/sell.tsx).

| Layout | What the person experiences | Judgment |
|---|---|---|
| **1. Photo library** | Familiar photo sections by state, compact scope controls and a full grid when a section opens. | **Recommended.** Best for recognising personal belongings and closest to your established direction. Remove duplicate state navigation instead of duplicating every shelf as a chip. |
| **2. Inventory list** | Small photos with aligned item, status and next-step information, like an order history. | Better for scanning comparable details and many items. Less inviting when the person mainly recognises things by sight. |
| **3. Stage overview** | A compact overview of where the collection stands; choosing a stage opens its items. | Best for “what is left to do?” Adds a step when the person already knows which item they want. |

Use the existing header action slot for Select. Separate state selection from optional platform/sort controls, show the active scope, and explain zero results with a clear way to reset it. Comfortable density comes from removing repeated structure before reducing spacing.

**Buy**

**Purpose:** Help someone turn a desire or curiosity into a confident purchase without repeatedly searching and comparing the same things.

Observed: search leads, followed by decisions, new matches, things being sought, saved listings and purchases. The distinction between a continuing search and a saved listing is valuable, but their current arrangement makes the person connect them across sections. The inspected default request has a truncated identifying description and an empty photo square while its search status is prominent. My inference: the request’s meaning deserves that space more than a placeholder image. A quiet page with one search is appropriate; it does not need unrelated recommendations to look full. [Buy implementation](../../../app/src/app/%28tabs%29/buy.tsx).

| Layout | What the person experiences | Judgment |
|---|---|---|
| **1. Search-first hub** | A familiar search entry followed by continuing searches, with new results grouped beneath the request they answer. | **Recommended.** Best fit for the person hunting something specific. It preserves the connection between desire, constraints and results. |
| **2. Discovery grid** | A marketplace-like image grid with search and meaningful filters above. | Best for browsing. It risks burying ongoing searches and optimising for scrolling; the browsing persona currently has weak evidence. |
| **3. Saved library** | Distinct Searches, Saved and Purchases views, each using its own suitable rows or grid. | Strongest for returning buyers managing several interests. Less immediate discovery, but clearer ownership of different objects. |

The search-first hub should preserve the whole request where it matters and distinguish “nothing suitable yet” from incomplete searching or failure. Every match should make its relationship to the request clear without demanding that the person remember it.

**You**

**Purpose:** Let someone understand whether secondhand is working for them and control the boundaries under which it acts.

Observed: the inspected page places connection problems, earnings, money movement, weekly performance, item states and listing performance before account controls. It is a long seller dashboard. A buyer with no sales instead sees “Nothing sold yet,” which frames legitimate use as something missing.

There is also a meaning problem in the money graphic: paid money, pending money and hypothetical future earnings share one bar directly beneath a headline for realised earnings. The parts do not divide the amount above them. Separate possible future earnings from money already earned, or explicitly name the combined quantity. A beautiful chart with an unclear denominator still misleads. [You implementation](../../../app/src/app/%28tabs%29/you.tsx), [money-bar calculation](../../../app/src/ui/parts/money-bar.tsx).

| Layout | What the person experiences | Judgment |
|---|---|---|
| **1. Account home** | A compact personal overview followed by grouped controls and clear destinations for deeper financial detail. | **Recommended.** Useful to sellers and buyers, with short paths to control and explanation. It sacrifices the immediate depth of a dashboard. |
| **2. Personal statement** | A banking-like view of earned money, pending receipts and history, with account controls nearby. | Strongest when financial reassurance is the main reason to return. It needs a different meaningful opening for a buyer. |
| **3. Progress overview** | An activity-style view of what has moved forward, followed by exceptions and control links. | Closest to the clearing-out person’s underlying goal. Requires care: progress must reflect their intent, not invented targets or streaks. |

I would keep a small, truthful overview in You and put detailed performance behind a clear destination. The current user should be able to understand both “what happened?” and “how do I change this?” without scrolling through an analysis they did not request.

**One coherent flow**

This is the proposed ownership and return structure. It preserves capabilities while moving detail to the place that owns it.

```text
App
├─ Today → decision → relevant item or conversation
├─ Sell → collection → item → one task or decision
├─ Buy → search or continuing request → results → listing
├─ You → personal overview → money, activity or account controls
├─ Messages, available from each main page → conversation
└─ New → chosen intent → capture/input → relevant result

Back / close → the exact origin, with its working context intact
Cross-link → the named destination, with the requested scope visible
```

Switching tabs should preserve each tab’s place and working context. Returning from an item should preserve scroll and filters. Explicit links such as “live things” must apply their filter every time, including when Sell is already mounted. Re-tapping the active tab should return to its root and then the top, without silently clearing filters. Refresh should update data while preserving drafts and chosen scope. These are proposed behaviors; current code does not establish the whole contract. Apple supports preserving navigation state within each tab, while the exact refresh and re-tap rules here are product choices. [Apple](https://developer.apple.com/design/human-interface-guidelines/tab-bars.md).

The observed gaps include filters initialised from the URL only once, local simulated actions that do not establish cross-page persistence, and no explicit shared refresh or scroll-restoration mechanism. Test a full sequence: enter normally, act, open detail, return, change tab, return again, refresh, and recover from failure. An isolated screenshot cannot prove that sequence.

**Improve the components where the problems begin**

Keep a small shared grammar: page frame, section, row, photo tile, decision, detail and temporary form. Give related elements the same anatomy; choose the arrangement from the task. A grid supports recognition, a list supports comparison, and a detail view supports concentrated judgment. Do not require every tab to use the same section body.

The most useful component changes are:

- Let cards grow when essential content or larger text needs room. Stable photo positions and action order matter more than identical heights in every state. Existing fixed card arithmetic leaves little spare space; clipping has to be tested, not inferred from a token checklist.
- Make section hierarchy consistent through the shared component. Today and Sell use shelves while Buy and You use another section implementation; authors should not have to remember different rules for equivalent headings.
- Separate immediate press feedback, navigation and operation progress. “Pressed” must not imply “saved.” Preserve honest pending, failure, retry and undo states.
- Remove copy that repeats what position, selection or a value already communicates. Preserve explanations that change a decision, disclose a consequence or identify a control for assistive technology.

These changes apply recognition, visible status, user control and recovery to the actual flow. They are uses of general heuristics, not evidence that any proposed layout has passed usability testing. [NNGroup’s usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).

**One brand across different media**

Share identity and meaning: the chosen typefaces, lowercase Clofie roles, icon family, honest item images, semantic colors and plain voice. Adapt composition to what the person is doing.

| Surface | Organisation and space | Type, color and motion | What must work |
|---|---|---|---|
| Native app | Short repeated visits; thumb reach; detail and temporary forms; state continuity. | Readable product type, restrained emphasis, immediate feedback and system accessibility. | Actual device input, keyboard, gestures, back behavior and operation recovery. |
| Signed-in web | Same objects and permissions; more room for comparison and simultaneous context. | Responsive layout, keyboard focus, hover where useful, zoom and reflow. | Complete product tasks without assuming a phone camera or touch input. |
| Public website | Explain the value, establish trust, show credible proof and provide a useful next step. | Larger display moments and purposeful motion can belong here; phone card geometry does not govern a hero. | Reading, navigation and demonstrated claims at the actual viewport. |
| Video | A sequence the viewer watches at a chosen pace; each shot must prepare what follows. | Type readable at playback size, deliberate holds/cuts, captions and sound considered together. | Meaning without clicking; truthful product footage; legible playback and accessible delivery. |

For web text, verify enlargement without losing content or functionality; the Web Content Accessibility Guidelines specify 200% for the resize-text criterion. For automatically moving website content, assess pause/stop/hide requirements instead of assuming a reduced-motion animation alone resolves every case. [W3C text resizing](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), [W3C movement controls](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).

The rule cleanup should preserve your locked choices and remove or narrow agent-proposed quotas that do not prove their intended outcome. Fixed word counts, universal color percentages, mandatory template shapes and one button ceiling cannot govern product screens, advertising and video equally. Keep them as scoped hypotheses only where evidence supports them. The incoming website work already contains approved exceptions and useful font/screenshot verification; reconcile that work before changing shared checks.

**Autonomous agents with evidence**

The repository already holds page purposes, interaction contracts, behavior tables, copy findings and a rule registry. Agents should receive the relevant current sources and run their actual consumers. Creating another universal design document would add another opportunity for disagreement.

The new `scripts/ui-proof.mjs` command now supplies that connection for the app: identify concrete pages, select existing contracts and real tests, execute them, and record what passed. Missing contracts or tests, zero executed passing tests, absent or mismatched renders, failed commands and inputs changed during execution fail the result. Each run keeps isolated render files and hashes its evidence. Multiple concrete paths through the same dynamic route must be checked separately. This is a local proof command, connected through the existing build instructions; it is not an unbypassable agent control. Existing CI separately runs app renders and browser tests.

Deterministic checks can test route behavior, arithmetic, contrast, clipping, font loading, accessible names and specified state transitions when those assertions are implemented. Coverage remains limited to the actual checks and journeys executed. A fresh critic must still judge priority, comprehensibility, comfortable density and whether the artifact feels intentional. A recorded judgment is evidence of review, not mathematical proof of taste. Ben retains direction and consequential taste choices.

The requested [Appllama usage method](https://github.com/Appllama/appllama-skills/tree/main/skills/appllama-usage) informs diagnosis and whole-flow comparison; the [app-design skill](https://github.com/Appllama/appllama-skills/tree/main/skills/appllama-app-design-skill) supplies implementation checks. No Appllama library connection was available, so this review does not claim to have inspected its app collection. The supplied [clean-copy skill](https://paste.rachel.systems/ukogokijaz.md) asks whether text should exist before polishing it. Existing [interaction proposals](../../../spec/interactions.md) and [copy findings](../../../spec/copy-cuts.md) remain source evidence, not automatically implemented or approved rules.

The shell correction and scoped proof tool are implemented and tested. The real Buy run passed 32 behavior tests and 10 shell tests, then correctly failed its render check on the cut-off request title. The proof tool passed nine regression tests; the renderer suite passed ten. The repository-wide gate remains failing, so these changes are local and unpushed. The twelve broader layouts remain alternatives, the complete proposed navigation contract is not demonstrated, and native behavior remains unverified. Web receives partial brand checks; video still needs temporal and audio verification. These are limits of the delivered work, not passes inferred from documentation.
