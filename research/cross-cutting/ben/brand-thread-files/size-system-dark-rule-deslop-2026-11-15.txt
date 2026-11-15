# One size system, a darker dark mode, and the rules worth enforcing
Researched 2026-11-15 for Ben, in the thread "Critique the design system and plan dark mode". Feature: brand (cross-cutting). Follows [dark-mode-hierarchy-audit-2026-11-15.md](dark-mode-hierarchy-audit-2026-11-15.md).

Method: RDD with IAE, using the `research` skill's deep mode. Claims are marked *observed*, *asserted* or *inferred*, as in the earlier note. *Measured* means my script or a headless render. Nothing in the repo was changed.

Picture: [size-system-and-dark-2026-11-15.png](size-system-and-dark-2026-11-15.png). Left is Today as the round 8 and 9 sheets draw it. Middle is the same content in one size system. Right is that system in dark by the mirror rule. **The type is still a stand-in.** Neue Montreal and Clofie are in Ben's Downloads folder, and reading it was blocked. The page loads them from a `fonts/` folder as soon as they're there, and nothing else changes.

## What Ben asked (01:16)

1. The renders don't use our fonts. *Waiting on the font files (see above).*
2. Shouldn't dark mode use darker colors, so it stays in a comfortable range? *Yes. That changes my earlier answer; see section 1.*
3. Things of a similar size should have one standard width and height, whatever is in them. "Offered $38" and "Nike Dunks" don't. *Section 2.*
4. Find repos and skills built to "deslop UI", and how they make a system cohesive and actually enforce it. *Section 3.*
5. What looks good to the eye without anyone noticing. *Section 4.*
6. Ban all emoji. *The brand system thread is writing it as a script check. My renders now use drawn icons.*
7. Which rules to enforce at all. *Section 5 is the candidate list, with evidence, for the brand system thread to decide on.*

## 1. Darker dark mode: the mirror rule

**What changed from the earlier note.** I had kept the light pastel fills in dark (Radix's model for small solids), with black text. Ben's comfort point is right, and it can be measured. In light mode our fills sit gently on white, at 1.2 to 1.5:1. In dark, the same pastels sit at 12 to 15:1 against the page. They stop being a ground and become the brightest things on the screen. Apple: "In dark environments, colors appear bright and saturated", and in visionOS, "avoid displaying a bright object on a very dark or black background" (*observed*, HIG Color).

**The rule:** every surface keeps the contrast it has against the page in light mode, measured against the dark page. The hue stays. Chroma drops by .015, because saturated color glares on dark (*observed*: Hallmark's dark recipe lowers accent chroma by .02 to .04; Material's codelab says saturated colors "vibrate"). Text on any surface uses the ink of its mode. The act is the ink color in both modes: a black pill in light, a near-white pill in dark.

One rule then covers everything (*measured*):

| Surface | Light, against white | Dark, against #101315 |
|---|---|---|
| State and category fills (L .88) | 1.2 to 1.5:1 | 1.2 to 1.5:1 at L .26 to .33 |
| The field | 1.4:1 | about 2:1, so it stays the one focal surface: sky #0A4C65, mint #03523B, lime #484A01 |
| Tints (notice, failed) | 1.1:1 | 1.3:1 |
| Gray control | 1.13:1 | 1.38:1 |
| The act | 19.8:1 (black) | 16.1:1 (#ECEFF1) |

Text stays easy on every dark fill: ink is 10.9 to 13.4:1 (APCA Lc 91 to 94), and secondary ink is 7.2 to 8.9:1 (Lc 65 to 68).

Mirrored fills, all chroma .015 lower than in light: lilac `#372E4B`, sky `#033447`, aqua `#003536`, mint `#023626`, lime `#252600`, marigold `#432E02`, peach `#492B13`, pink `#4A2A32`.

**Exception: marks on a photo** (the corner tag) keep their light values, because they sit on the photo, not the page (*inferred*).

**The cost, plainly.** Yellow can't be dark and still read as yellow. Lime at this lightness is olive, and sRGB can't hold more chroma there (*measured*: the gamut caps lime at chroma .09 near L .4). In the picture, the field's lime corner reads olive. Two ways out, both Ben's call: accept it (night version of the brand), or let lime's share of the dark field shrink to a corner and lead with sky and mint.

**This changes A5.** The constitution says text on color stays black in both modes. Under the mirror rule it becomes "text on any surface is the ink of its mode". That's a brand decision for Ben, routed through the identity thread.

## 2. One size system: same kind, same size

**What's wrong now** (*observed* in the round 9 sheet `clofie-K2.png` and the left phone). The offer is a gradient box with no photo. The Nike Dunks is a bare row with a photo. "You keep $31.40" floats on its own, and the buttons sit on the page. That's three shapes, three widths and three heights for what is really one kind of thing: an item that needs one action from you. The offer doesn't even name the item, which breaks E1 (the item leads).

**What the deslop work says.** Every catalog names uniformity as the root of slop: "uniformity + unconsidered defaults", "N identical icon cards, same size" (*observed*: unslop-ui-skill TELLS.md, avoid-ai-design catalog). Apple asks for the opposite inside a kind: components with "a shared anatomy and core interactions that remain the same" (*observed*, WWDC25 "Get to know the new design system"). Both are true at once. Things of one kind share one size. Different kinds differ on purpose, so the difference carries meaning (*inferred*). Ben's ask is the first half. The second half keeps it from turning into the slop grid.

**How heights stay fixed whatever the content:** fixed slots plus truncation. One-line title, one-line detail, a photo of fixed size, and a fixed action band. Content never grows a box; long text truncates, and the full text is one tap away (*inferred*; it's how native list rows work, *asserted*).

**The kinds** (390 pt screen, 20 gutter, so 350 wide). Named as `data-part` values so the brand system thread's render checker can hold each to one size within 1 px:

| `data-part` | Width | Height | Radius | Inside |
|---|---|---|---|---|
| `notice` | 350 | 56 | 28 (capsule) | 16 sides; icon 24, one line of 15/20, close 24 |
| `card-item` | 350 | 104 | 36 | 16; photo 72, title 17/22 at 500, detail 15/20 |
| `card-decision` | 350 | 156 | 36 | `card-item` plus 12 gap plus a 40 action band |
| `photo-thumb` | 72 | 72 | 20 | 36 − 16, concentric with the card |
| `pill-card` | content, min 40 | 40 | 20 (capsule) | 20 sides, half its height |
| `pill-page` | content, min 48 | 48 | 24 | 24 sides |
| `tag-photo` | content | 20 | 10 | 6 sides; icon 13, 13 text |
| `icon` | 24 | 24 | | stroke 1.5 |
| `nav` / `tabs` | 390 | 44 / 84 | | from tokens |

Gaps: 12 inside a card, 16 between cards, 40 between sections.

*Measured* in the render: both cards are 350 × 156 and the notice is 350 × 56, in light and dark. "Offered $38" and "Nike Dunks" are now the same size, with the same photo slot, the same left edges and the same action band. The offer card leads with the jacket's photo, and the sale card carries "You keep $31.40" in its detail slot. The big 50 pt amount belongs to the sale moment, not the feed.

## 3. The deslop repos: what they enforce, and what we take

Cloned and read 2026-11-15. Who made them matters (Ben's rule): Impeccable is Paul Bakaus's (ex-Google, creator of jQuery UI), Hallmark is Hassan El Mghari's (Nutlope), ui-skills is Julien Thibeaut's (ibelick, Motion Primitives), and frontend-design is Anthropic's. The other three are from individuals I couldn't vet, so I used them only for their catalogs.

| Repo | How it enforces | What we take |
|---|---|---|
| pbakaus/impeccable (updated 2026-11-14) | A detector (Rust and browser JS) with 62 named anti-patterns, run on files and on the live page. Plus a "craft floor" checklist | Rules we lack: `monotonous-spacing`, `flat-type-hierarchy` (roles under 1.25× apart with no other change), `dark-glow` ("any colored blurred shadow on a dark background"), `gray-on-color`, `cramped-padding`, `nested-cards`, `tiny-text`, and off-scale radius and size (*observed* in `antipatterns.json`). Its floor also bans "Unicode glyphs or emoji standing in for an icon system" (*observed*) |
| Nutlope/hallmark (2026-11-11) | Numbered gates, plus a recipe that re-derives every dark token from the light one | The dark recipe: paper at L .12 to .18 and never #000; +3% lightness per elevation level; ink at L .92 to .96 and never #fff; accent chroma down .02 to .04; "cards lighter than canvas"; shadows off in dark (*observed*). It matches what I derived independently. One disagreement: it bans dimming photos with CSS, while Apple suggests darkening white-background images. I'd follow Apple for item photos, since we can't choose them |
| ibelick/ui-skills `baseline-ui` | MUST, SHOULD and NEVER lines for an agent to review a file against | "NEVER use glow effects as primary affordances"; "MUST use `tabular-nums` for data"; one accent per view (*observed*) |
| claudiusararu/unslop-ui-skill, funboy322/avoid-ai-design, samigiman/anti-slop-skills | Catalogs of about 100 tells, and small scanners | The root-cause framing (uniformity plus defaults), and "uniform vertical rhythm" as a tell (*observed*) |
| anthropics/skills `frontend-design` | Prose guidance only | Nothing beyond the above |

**What none of them has:** a "same kind, same size" check. The brand system thread's render checker can do it by `data-part`, which would put us ahead of all of them (*inferred*).

**What we already do better:** our constitution pairs each tell with what to reach for (Art. 13), and our states carry meaning. The repos mostly ban without a replacement (*inferred*).

## 4. What the eye takes in without noticing

Each of these is invisible when right and felt as "off" when wrong.

1. **Corners that nest.** Apple: "There's a quiet geometry to how our shapes fit together, driven by concentricity". Its three shape types are fixed, capsule (radius half the height) and concentric (the parent's radius minus padding). It also warns about "corners that feel too pinched — or flared", especially "artwork in a card" (*observed*, WWDC25). Ours now: card 36 = photo 20 + padding 16, and pills are capsules.
2. **Continuous corners.** iOS shapes use a continuous curve, not a circular arc (*asserted*). React Native exposes it as `borderCurve: 'continuous'` on iOS (*observed*, RN docs). It's a one-line change in `layout.tsx`.
3. **Optical centering.** Apple: views are "mathematically centered when it makes sense — and subtly offset when it doesn't" (*observed*). In practice: center a pill's label on its cap height, not its line box, and nudge asymmetric icons (chevrons, play) toward their visual weight. Judge-only.
4. **Two intervals, not one.** Tight inside, generous between. Every deslop repo has this as a tell (*observed*), and NN/g's scanning data rests on clear groups (*observed*, earlier note).
5. **A step you can feel.** Size roles at least 1.25× apart, or a weight change where they are closer (*observed*, Impeccable's `flat-type-hierarchy`). Our 15 to 17 step carries a weight change; 17 to 22 is 1.29×.
6. **Fixed slots.** Heights that don't move as content changes; truncation instead of growth (section 2).
7. **Numbers that don't wobble.** Tabular figures on amounts that change (*observed*, baseline-ui; our Art. 6.7).
8. **Pill ends that look even.** Side padding equal to half the height (20 on 40) (*inferred* from capsule geometry).
9. **Icons sized to the text.** 24 pt icons with 15 to 17 pt text, a 1.5 stroke to match regular weight, and one icon set (*inferred*; brand Art. 10).
10. **Neutrals tinted toward the brand.** Page, surfaces and grays carry a trace of sky's hue (chroma .006) (*observed* as Hallmark's "anchor-tinted"; our `--gray` already does this).
11. **No glow doing a button's job.** Two independent repos call it a tell (*observed*), and in dark it reads as neon (earlier note).
12. **Cards lighter than the page in dark;** "a card darker than its ground reads as a hole" (*observed*, Hallmark).

## 5. Candidate rules for the brand system thread

In its row format: rule, script or judge, what fails, media, evidence. App and web carry dark rows; posts, stories and decks are light only.

| # | Rule | How checked | Fail if | Media | Evidence |
|---|---|---|---|---|---|
| S1 | Same kind, same size | Script | Two elements with the same `data-part` differ by more than 1 px in width or height | app, web, post, deck | WWDC25 shared anatomy; section 2 |
| S2 | Kinds use the size table | Script | A `data-part` renders at a size not in the table | app, web | Section 2 |
| S3 | Corners nest | Script | A child within 24 px of its parent's corner has radius ≠ parent radius − inset (±2), and isn't a capsule | all | WWDC25 concentricity |
| S4 | Capsules are exact | Script | An element with radius ≥ 999 renders with radius ≠ height/2, or its side padding ≠ height/2 (±2) | all | WWDC25; item 8 |
| S5 | Fixed slots | Script | A title or detail slot inside a card wraps to a second line | app, web | Section 2 |
| S6 | Two intervals | Script | Inside-card gap ≥ between-card gap, or one gap value covers more than 70% of vertical gaps in a view | all | Impeccable `monotonous-spacing`; Art. 7.2 |
| S7 | Felt type steps | Script | Two text roles in a view are under 1.25× apart and share weight and ink | all | Impeccable `flat-type-hierarchy` |
| S8 | Mirror rule | Script (on token values) | A dark surface's contrast against the dark page differs from its light value by more than 0.15 | app, web | Section 1 |
| S9 | Text on surfaces | Script | Text WCAG < 4.5:1 or APCA \|Lc\| < 75 for body, < 60 for secondary, in either mode | app, web | Earlier note §3 |
| S10 | No glow in dark | Script | Any colored blurred shadow under `[data-theme="dark"]` | app, web | Impeccable `dark-glow`; Hallmark |
| S11 | Ladder | Script | In dark, page < surface < sheet in OKLCH L fails, or a step is under .03 | app, web | Apple base and elevated; Hallmark +3% |
| S12 | No emoji | Script | Any emoji code point in rendered text or source strings | all | Ben, 01:16; Impeccable craft floor |
| S13 | Continuous corners | Script (source) | A rounded `View` in the app without `borderCurve: 'continuous'` | app | RN docs |
| J1 | Optical centering | Judge | A label or icon looks off-center in its pill or circle at 2x | all | WWDC25 |
| J2 | Same kind looks the same | Judge | Two things a person would call the same kind are drawn differently | all | Section 2 |
| J3 | Dark comfort | Judge | On a dark render at 50% brightness, any surface pulls the eye more than the one focal card | app, web | Section 1 |

**What I'd leave unenforced:** golden-ratio proportions, rule-of-thirds placement and color-harmony formulas. The evidence doesn't support them (earlier note §4), and a check on them would block good work for no perceived gain (*inferred*).

## What I couldn't reach or didn't do

- The real fonts (blocked, above). Every render here uses a stand-in.
- No test on an OLED phone.
- The size table is drawn for Today. Sell's grid, the listing page and sheets need their kinds added the same way.
- The Apple and studio brand-system research is running in the brand system thread; I didn't duplicate it.
