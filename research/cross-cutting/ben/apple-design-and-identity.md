# How does Apple define its design and brand system across everything it makes, and which of its rules can a small brand check with agents?
Researched 2026-11-15 by Ben (Claude Code agent, Fable 5.2, research helper). Feature: cross-cutting.

Feeds the checks in [brand/constitution.md](../../../brand/constitution.md) Part IV and the dark mode row in [brand/ledger.md](../../../brand/ledger.md).

**Reach.** The web was open. developer.apple.com was read as raw page text, so those quotes are exact. apple.com and support.apple.com came only through a summarizing fetch, so the identity PDF and the Apple Style Guide are marked "via summary" and may be paraphrase. Every row is *observed* on the named page on 2026-11-15 unless marked *asserted* or *inferred*. Every "take" is an *agent proposal*.

**Draft from memory, and what changed.** Draft: Apple's tints and glass fight "color is a ground" and "never glass", and Apple's dark mode is black and white. After reading: the 2025 and 2026 HIG moved toward us on color, glass conflicts only in the app's bars, and the logo rule is a conflict I had not expected.

## Sources and their jobs

| Source | Date on it | Job |
|---|---|---|
| [HIG](https://developer.apple.com/design/human-interface-guidelines), 22 pages: design principles, the 15 foundations in the brief, launching, onboarding, feedback, loading, charting data, buttons | Change logs to 2026-10-28 (App icons); Branding and Layout 2026-09-09; Design principles "Reintroduced" 2026-06-08 | Evidence: live rules, dated per page |
| WWDC26 251 "Communicate your brand identity on iOS"; WWDC25 219 "Meet Liquid Glass"; WWDC19 214 "Implementing Dark Mode on iOS" (transcripts) | 2026, 2025, 2019 | Evidence: where a brand may show, glass limits, dark structure |
| [App Store marketing guidelines](https://developer.apple.com/app-store/marketing/guidelines/) | Undated, © 2026 | Mechanism: clear space, size, misuse, screens, video |
| [Identity guidelines for channel affiliates](https://www.apple.com/legal/sales-support/certification/docs/logo_guidelines.pdf) (PDF) | March 2013 (via summary) | Mechanism: Apple's fullest public identity manual, though old |
| [Apple Style Guide](https://support.apple.com/guide/applestyleguide/welcome/web), nine pages | Newest change read: June 2025 | Evidence: writing |
| [UI Design Dos and Don'ts](https://developer.apple.com/design/tips/) | Undated | Floor numbers |
| PJ Camillieri, ["This is how we make slides at Apple"](https://medium.com/adventures-in-consumer-technology/this-is-how-we-make-slides-at-apple-b8a84352bf6d) | 2019-11-18 | Weak signal, *asserted*: a former Apple marketer, not Apple |

## 1. How Apple structures it

| Layer | Where | Decides | Leaves alone |
|---|---|---|---|
| Principles | Design principles: purpose, agency, responsibility, familiarity, flexibility, simplicity, craft, delight | How to weigh priorities. "There's no one right way to apply these principles." | Any value |
| Foundations | 18 pages | Rules for every platform, and the floors (11 pt, 44 pt, 4.5:1) | Which screen |
| Patterns | 25 pages by task | What happens at a moment (launch, first run, loading) | Look |
| Components | A page per control | Each part's look, behavior and how far it bends | When to use it |
| Platform | "Designing for" pages; a closing section on every page | Exceptions per device | Shared rules |
| Resources | Templates, fonts, SF Symbols, bezels, badges | The files. A rule is kept by using the file | |
| Marketing identity | Marketing guidelines; identity PDF | How Apple's marks sit in someone else's material | The partner's own look, which must not copy apple.com (via summary) |
| Writing | Apple Style Guide; HIG Writing | Usage, capitals, punctuation, units. Defers to Chicago and Merriam-Webster (via summary) | A third party's voice |

Nothing public from Apple covers presentations. *Inferred*: three habits make the system enforceable. Each page has a dated change log. Numbers sit in the lower layers and reasons in the upper. A mark's rules ship with its artwork.

## 2. Do and don't

"Ours" cites the brand constitution unless named. H have, L lack, X contradicts, D differs on purpose.

| Id | Apple's rule (page) | Ours |
|---|---|---|
| | **Branding in an interface** | |
| A1 | "Ensure branding always defers to content." Standard parts for plain tasks (Branding) | H: E1, L11 |
| A2 | "Resist the temptation to display your logo throughout your app." NYT Cooking shows its logo on the Home tab only, fading on scroll (Branding; WWDC26 251) | X: C1, wordmark on every main screen |
| A3 | "Avoid using a launch screen as a branding opportunity." It is "nearly identical to the first screen", with no text (Branding, Launching) | L |
| A4 | A brand on site, marketing and app "shouldn't default to being the same" (WWDC26 251) | H: Part III |
| | **Color** | |
| A5 | "Apply your app's accent color judiciously": primary actions, status, the selected tab. One color, one meaning (Branding, Color) | H: Art. 5.2, 5.3 |
| A6 | "To emphasize primary actions, apply color to the background rather than to symbols or text." (Color) | H: Art. 5.1 |
| A7 | A custom color has light, dark and increased contrast values, "Even if your app ships in a single appearance mode" (Color) | L: increased contrast |
| | **Dark mode** | |
| A8 | "Avoid offering an app-specific appearance setting." (Dark Mode) | L: tokens switch on `data-theme` only |
| A9 | Base and elevated backgrounds: "the elevated colors are brighter, making foreground interfaces appear to advance". Not an inversion (Dark Mode) | L: one page, one gray |
| A10 | At least 4.5:1 (3:1 from 18 pt or bold); "strive for a contrast ratio of 7:1, especially in small text" (Dark Mode, Accessibility) | H: B6; L 7:1 |
| A11 | "Soften the color of white backgrounds" in content images (Dark Mode) | L: item photos |
| A12 | Separate light and dark icons or images "if necessary" (Dark Mode) | X with a strict "only color changes": black logos (C5) |
| | **Typography** | |
| A13 | A custom font supports Dynamic Type and Bold Text. Floor 11 pt, no light weights (Typography) | H: Art. 6.8; X Bold Text against B13 |
| A14 | Text grows 200 percent, untruncated; not every label must grow (Accessibility, Typography) | H: frontend-standard; L: which roles stay |
| A15 | Hierarchy by weight, size and color (Typography) | D: Art. 6.1, size and two inks |
| | **Layout** | |
| A16 | Controls 44 by 44 pt, about 12 pt apart (Accessibility) | H 44; L the gap |
| A17 | Content runs under the bars, with no "solid or semi-opaque background color beneath controls" (Layout, 2026-09-09) | X if our tab bar is opaque |
| | **Motion** | |
| A18 | "Add motion purposefully"; optional; cancelable; none on frequent actions (Motion) | H: frontend-standard §3 |
| A19 | Reduce Motion cuts "automatic and repetitive animations"; fades replace travel (Accessibility) | L: the field's drift (C2) |
| A20 | No autoplay without controls. "Minimize use of time-boxed interface elements." (Accessibility) | L: site hero, the 5 s Undo toast |
| | **Imagery and icons** | |
| A21 | One icon style and stroke, a text label for each (Icons) | H: Art. 10; L labels beyond C5 |
| A22 | "Don't flip logos"; mirror only icons that show direction (Right to left) | L |
| A23 | App icon: simple, text "only when it's essential", same features in dark and tinted (App icons, 2026-10-28) | L |
| A24 | Images at their own aspect ratio (Dos and Don'ts) | L |
| A25 | Marketing shows the app "exactly as a user will experience it": no tilt or reflections; made-up account data (Marketing) | H in part: Part III, Art. 8.4 |
| | **Writing** | |
| A26 | "Check each word to be sure it needs to be there." Verb-first buttons. Errors give the fix. "Avoid using we altogether" (Writing) | H: Art. 12, copy.md |
| A27 | Title case buttons (Buttons). Exclamation points "occasionally in promotional text"; money as "1199 USD" (Style Guide, via summary) | D: Art. 6.5, 12.5, C6 |
| | **Marketing and identity** | |
| A28 | Clear space: a quarter of the badge's height; half the logo's height for a signature (Marketing; PDF, via summary) | L |
| A29 | Minimum: badge 10 mm in print, 40 px on screen; signature 8 mm, 35 px (same) | H screen and video (C1); L print |
| A30 | Don't "modify, angle, or animate"; no shadows, glows or 3D; black or white; never on a busy ground; one per layout, "in a subordinate position" (same) | H in part: C1, E1 |
| A31 | Supplied artwork only; never rebuild a mark (same) | H for C5; L for our wordmark |
| A32 | Credit other firms' marks once, with the legal text (Marketing) | L |
| A33 | Video: "straightforward transitions such as fade or dissolve", the app's own sounds, a "sequences shortened" notice (Marketing) | H: Art. 11; L the notice |
| | **Accessibility** | |
| A34 | Never color alone for state or for what is tappable (Color, Accessibility) | H: States |
| A35 | Text for anything said in audio or video (Accessibility) | L for video |

## 3. Where Apple and our brand disagree

| Topic | Who wins for us, and why |
|---|---|
| Wordmark on every screen (A2, C1, L3) | Ben's words bind. They say "right at the top, centered"; the every-screen reading is ours. *Agent proposal* for Ben: the wordmark on Today only, screen titles elsewhere. *Inferred*: that frees the nav bar on four tabs for content (E1). |
| Tints against "color is a ground, never ink" (A5, A6) | Ours. The live HIG puts color behind the one primary action and in content, which is our rule. Apple marks tappable text by tint, so we must mark it by shape every time. |
| Fixed sizes against Dynamic Type (A13, A14) | No conflict at the default size (Art. 6.8). Apple wins twice: Bold Text may raise weights, so B13 needs that exception, and layouts hold at 200 percent. |
| Liquid Glass against "never glass" (Art. 9.2, 13) | Split by layer. In content, and in every medium but iOS chrome, ours wins, and Apple agrees: "Don't use Liquid Glass in the content layer." (Materials). If the tab and nav bars are system parts, Apple wins there: take what the system draws and never imitate it. A custom opaque bar is the conflict (A17), for Ben and Nate. |
| Field "never static" (A19) | Apple, under Reduce Motion only. |
| Title case, ISO money, exclamation marks (A27) | Ours. Those rules serve manuals. |

**Dark mode verdict.** "Only color changes" holds, if color includes dimming a photo and recoloring a logo.

- **Stepped surfaces: supported.** Base and elevated sets of three levels are Apple's own structure (A9). *Inferred*: shadows do not read on a dark page, so steps and hairlines are the only depth left.
- **The values are not Apple's.** Its base is "pure black in dark mode" (WWDC19 214) and its dark grays are 28,28,30, then 44,44,46, then 58,58,60 (Color table; their use as raised backgrounds is *asserted* from memory). The HIG does not require black.
- **Off-white text: allowed, not endorsed.** Apple's dark label is white (*asserted*, memory). Its test is contrast: `#ECEFF1` on `#101315` is 16.2:1, and at 65% it is 7.3:1 (computed). Both pass A10, so the choice is taste and Ben's.
- **Missing from the plan:** the system setting (A8), increased contrast values (A7), dimmed white-ground photos (A11), light versions of dark logos (A12).
- **Test, don't assume:** fills and the field stay unchanged. A sky fill is 13.1:1 against `#101315`, a bright slab on a dark page, and Apple tells dark app icons to "avoid excessively bright images". One look at night brightness.

A signed-out site that moves fits Apple's rules when the motion has a job, stops under reduced motion and has controls (A18 to A20).

## 4. Checkable form

| Rule | One testable line | Check |
|---|---|---|
| A2, if Ben agrees | The wordmark appears on one tab's screens | Script, DOM |
| A3 | The launch screen has the first screen's layout and no string | Script, source |
| A7, A10 | Every text and ground token pair is 4.5:1 or more in light, dark and increased contrast; 7:1 under 18 px in dark | Script, source: tokens.css |
| A8 | Dark values apply under `prefers-color-scheme`; the app has no theme control | Script, source |
| A9 | Dark has three surface tokens, each lighter than the last; a sheet uses the step above its parent | Script: token order; DOM parent and child |
| A11 | In dark, a photo with near-white edge pixels carries the dim layer | Script, pixels |
| A12, A22 | Every logo is 3:1 or more against both pages and never mirrored | Script, DOM and pixels |
| A13, A14 | With Bold Text on at the largest size, no label is cut off or overlaps | Judge on a screenshot; truncation by script |
| A16 | Tappable boxes are 44 by 44 or more and 12 or more apart | Script, DOM rects |
| A19 | With reduced motion set, nothing animates without a touch | Script, DOM: `getAnimations()` |
| A20 | No autoplay media without controls; nothing dismisses itself in under 5 s | Script, source |
| A21 | Every icon and logo node has an accessible name | Script, DOM |
| A24 | An image's drawn ratio equals its file ratio within 1% | Script, DOM |
| A25 | Marketing screens are real captures | Judge: "Is any app screen tilted, reflected or showing a real person's data?" |
| A28 | Nothing sits within one x-height of the wordmark (*agent proposal*) | Script: DOM rects; pixels for posts, slides, frames |
| A30 | The wordmark has no transform, shadow, filter or animation | Script, DOM: computed style |
| A31 | One component draws the wordmark | Script, source |
| A32 | A page with platform logos has one credit line | Script, source |
| A33 | A cut screen recording says it was shortened | Human |
| A23 | The app icon reads at 60 px and has no text | Judge; feel goes to Ben |
| Slides (weak signal) | One idea per slide; no text under 30 px at 1920 wide | Script: text blocks and smallest size |

## 5. Worth borrowing

1. **Two layers** (WWDC26 251: "the content layer is the best opportunity to express your brand identity"). Take: brand lives in content (field, photos, money); controls stay black, white and gray. Change: apply it to slides and posts, where the chrome is the wordmark and page number.
2. **The mark's kit** (A28 to A31): clear space, minimum size, misuse list, one per layout, one artwork. Change: measure in the wordmark's own height, so one rule covers every medium.
3. **Base and elevated surfaces** (A9). Change: our values, hairlines kept.
4. **Colors named by purpose**, and "Avoid redefining the semantic meanings" (Color). Take: dark tokens named by level, and a check that a line token is never a text color.
5. **Do and don't picture pairs** (every HIG page). Take: one pass and one fail render per code. Change: they double as check fixtures and judge examples.
6. **A dated change log on each rule doc.** Change: generate it from git.
7. **The launch screen rule** (A3), as is.
8. **Increased contrast and Bold Text** (A7, A13). Change: only `--ink-2`, `--rule` and `--ink-disabled` need a third value.
9. **Marketing screen rules** (A25, A33). They serve E3 on the site, posts, video and deck.
10. **"Don't mistake delight for decoration"** (Design principles). Take it as the judge question for any bold move on the site.

## 6. What I searched and could not open

- Read in full: the 22 HIG pages and the WWDC26 251 transcript. By keyword only: WWDC25 219 and WWDC19 214. Fetched and unused: WWDC 2017 802, 2018 803 and 2020 10175, which cover ground already in frontend-standard and [motion-and-speed.md](motion-and-speed.md).
- Through a summarizer only: the identity PDF and the style guide. Its change list was cut off, so changes after June 2025 may exist.
- Not opened: other component pages, platforms beyond iOS, Apple's trademark guidelines, the Design Resources files, UIKit's color values.
- Keynote slides: no Apple source found.
- Not done: the summary line on a feature page, since this task was limited to one file.
