# The secondhand brand constitution

How everything secondhand puts in front of a person is made: the app, the website, an Instagram post, a video, a pitch deck, a sticker. It is written so that any agent, in any medium and any language, can check its own output against it before a person sees it.

Asked for by Ben on 2026-11-14 at 20:17 and 20:20 ([words](../product/words.md#2026-11-14-constitutions), [intention](../product/words.md#2026-11-14-extreme-intention)). It sits beside two other documents and does not repeat them:

| Question | Authority |
|---|---|
| What a screen does, which flows exist, what text appears, how UI research and decisions are made | [product/ui-constitution.md](../product/ui-constitution.md) |
| How each string is written (anti-claudish rules, lint) | [product/copy.md](../product/copy.md) |
| How a screen is built, audited and animated | [product/frontend-standard.md](../product/frontend-standard.md) |
| **How anything looks and sounds, in any medium** | **this file** |
| The values (colors, sizes, radii) | [tokens.css](tokens.css) |

**Status.** Article 1 is Ben's words and binds now. The ends in Part I are drawn from his words and are marked where they are my reading. Every concrete value (a hex, a typeface, a size) is an *agent proposal* until Ben picks it in the [brand kit](https://claude.ai/artifact/NdqVRvvD43fFPnhxDFbiFZ). His pick replaces the proposal here and in `tokens.css` in the same commit.

**Precedence, highest first** (ui-factory): Ben's direct decisions; then this constitution's ends; then its codes and rules; then the approved image for a surface; then the code as it stands; then agent inference. A rule that conflicts with the code is fixed in one place, not overridden by a second rule.

---

## Part I. Ends

The ends are what the brand is for. Everything in Parts II to IV is a means and may be replaced by a better means that serves the same end. A means Ben chose on purpose (a typeface he named, a gradient he said he loves) is kept until he changes it. A symptom he reports ("this feels janky") is reliable; a fix he names alongside it is a guess to test. (Ben's global instructions.)

**E1. The item and the money are the heroes. The brand is the light they are shown in.** secondhand exists so a person can sell or buy a used thing without thinking about it. On every surface the thing itself (its photo) and what it is worth come first; the brand never competes with them for attention.
*Test:* squint at the output. The first thing you see is an item or an amount of money. If it is a logo, a gradient or a headline, the output fails, unless its job is brand recognition (an app icon, an end card).

**E2. Calm and fast, like a second hand that does the work.** Ben's two meanings of the name: your second hand (it acts for you) and the second hand of a clock (speed). The feeling is relief, not excitement.
*Test:* nothing on the surface asks for attention it has not earned. No urgency, no celebration, no movement without cause.

**E3. Honest enough to trust with a stranger's money.** Used goods and strangers are the two things people distrust most. Every number means something a person can say back in their own words; every photo shows the real thing; nothing is invented.
*Test:* pick any number or claim. A person who has never used the app can say what it means and where it came from. ("Similar ones sold for $36 to $52" passes. "Sold $36–52 · n=41" fails. Ben, 20:17: "i have no clue what that means.")

**E4. Recognizable in one second, in any medium, without the logo.** Someone scrolling past a post, a site or a frame of video should know it is secondhand from the codes in Part II alone.
*Test:* crop out the wordmark. A person shown three secondhand outputs and three others picks out the three.

**E5. Unrecognizable as AI-made.** Ben: apps and websites should lose "ai tells". Output reads as made by a person with taste who made choices, not as the most likely answer.
*Test:* the default test in Article 13.

**E6. Cheap to apply and hard to get wrong.** Ben wants the brand "token efficient, deterministic, and easily generalizable without making all ui's bland and generic and drab" (ui-factory brand stage). A small number of codes, each with a value and a boundary, beats a long style guide.
*Test:* every rule in Part IV can be checked by a script or a single look, by an agent that has read only this file and `tokens.css`.

---

## Part II. Articles

### Article 1. Extreme intention

> "everything needs to be done with extreme intention." Ben, 20:20.

Every element in an output has a stated reason. An element is anything a person can perceive: a color, a typeface, a size, a weight, a radius, a shadow, an image, an icon, a word, a pause, a movement, an empty space that was chosen.

1. **The reason comes from this file or is written down.** Each element maps to an end (E1 to E6), a code (Article 4) or a rule. If it maps to none, the maker writes the reason in the output's notes (the PR description, the post's caption file, the video's edit notes) in one line. If no reason can be written, the element is removed.
2. **"It looked empty" is not a reason.** Neither is "for balance", "to add visual interest", "modern", or "it's standard". Those are the reasons a model gives for its defaults.
3. **The default needs the strongest reason.** If an element is what an image model or a template produces with no brand (see `explore/round-2/brand-sheets/none-default.png`), it needs a reason tied to an end, not a habit.
4. **Fewer, louder choices.** One focal point per view. One brand field per view. One primary action per decision. When two elements compete for the same job, one goes.
5. **Removal is a valid edit.** The best fix for most problems is deleting something.

*Check:* the reason ledger. For any output, list its elements, and next to each the end, code or written reason. Count the blanks. Zero blanks to ship.

### Article 2. Ends bind; means are proposals

1. When a rule here gets in the way of an end, the end wins and the rule gets fixed (in this file, by proposal to Ben), not quietly broken.
2. A method mentioned on the way to a goal is a suggestion. A mechanism Ben chose on purpose is kept. An example is not the whole scope. (Ben's global instructions.)
3. Never fix a symptom by adding a rule elsewhere. Find the class of problem and fix it at its source.

### Article 3. References have jobs

The brand is built from Ben's references, each with one job. A reference supplies the property named for it and nothing else ("never copy a whole interface"; "a matching palette with different type, shell geometry or hierarchy is drift").

| Reference | Job it holds | Take | Do not take |
|---|---|---|---|
| ref-12 (Exalt / Meshed dashboard) | **The brand field.** Ben, 20:17: "i love the sky and lime gradient" | A soft mesh of sky, mint, lime and a peach corner, with visible texture, held to one band of the page. Black pills as punctuation. | Its greeting copy ("Good morning…"), its testimonial, its desktop layout |
| jpg(12) (Docket notes) | **Color as category.** | Flat fills from the same family (lime, marigold, coral, lilac, cyan) used to tell kinds of things apart. Black round controls on color. Generous crop. | Rounded geometric display type, candy saturation everywhere |
| jpg(17) and ref-28 (Sana automations) | **Real logos and mixed cards.** | Real third-party logos as small chips. Solid color feature cards beside white outlined cards. A filled pill next to a plain text action. | Its density, its dark maroon card with coral text |
| QOVES case study | **Type setting.** | Book weight for display, medium only on buttons, two luminances instead of bold, small labels | Its clinical palette |
| Quechua, ref-22 | **Product photography.** | Real products on stone and plain grounds, daylight, the object large in frame | Outdoor lifestyle scenes |
| Amigo, Home_X | **One warm signal.** | A single brick red for alerts | Its use of brick as a page color |

Avoid as sources: AI concept galleries for anything beyond color and mood (most of the Dribbble shots are concepts, so their layouts are unproven), painted illustration, frosted glass, cream instead of white. In step 1, ref-12 and jpg(12) were marked "rainbow mesh" and "candy" to avoid. Ben's 20:17 message overrides that: the gradient is in, held to one field per view (Code C2).

When a new reference is added: name its one job, say whether it is a requirement or a weak signal, and add a row here.

### Article 4. The codes

The few signature assets that make secondhand recognizable (E4). Each has an exact value in `tokens.css` and a boundary. Every output uses the codes that its medium can carry (see Part III) and no codes that are not on this list.

**C1. The wordmark.** "secondhand", all lowercase, one word, set in the display face (Article 6), black on white or on the field.
- App: centered at the top of every main screen, in the navigation bar. Ben, 20:17: "the secondhand wordmark should be right at the top, centered."
- Web: top left in the header, and once large in the footer.
- Post: top center or bottom center, small, the same place on every post in a series.
- Video: the end card only, centered, held for at least 1.5 s.
- Boundary: never in a sentence, never capitalized, never with a tagline attached, never smaller than 14 px (app) or 3% of frame height (video), never recolored except black or white.

**C2. The field.** A textured mesh of sky, mint and lime, with an optional peach corner, sampled from ref-12. It is the brand's one color event.
- One field per view: one card, one band, one panel, one frame.
- It always carries texture (grain or fine mesh lines). A flat two-stop CSS gradient is an AI tell.
- It sits behind the most important thing (the decision that needs you, the hero of a web page, the one stat in a post), never behind long text.
- Text on the field is black only. Every field color passes 9:1 with black and fails 3:1 with white.
- Boundary: never full-screen in the app, never as a border or text fill, never two fields touching, never animated as a loop.

**C3. The item leads.** Every item is shown by its photo, and the photo is the largest image in its group. A real photo of the real thing, in daylight, on a plain ground. Ben, 20:17: "for a carhartt jacket, you should probably have a picture of it."
- Boundary: no item without a photo (use a neutral tile with the category icon only while the photo loads); no illustration of an item; generated photos only in demos, marked as such.

**C4. The black pill is the act.** The one action that moves things forward is a black pill with white text. One per decision, and on the app at most one per card.
- Boundary: never red, never on the field in anything but black, never two black pills side by side.

**C5. Platform logos, not names.** Where a marketplace is meant, its real logo is shown, from [assets/platforms/](../assets/platforms/). Ben, 19:59.
- Boundary: unaltered logos only, brand color or black, never redrawn letterforms. VoiceOver and alt text carry the name.

**C6. Plain money.** Amounts are set in the text face with tabular figures, with the currency sign, at the same size as the text around them or one step up. The amount you keep is the one number that gets the lime highlight (a band behind the lower 40% of the figures).
- Boundary: one highlight per view; never a counter animation; never a big number without what it is ("$46.95" alone fails; "You keep $46.95" passes).

### Article 5. Color

| Role | Name | Value (proposal) | Use | Never |
|---|---|---|---|---|
| Page | White | `#FFFFFF` | Every page, screen and post ground | Cream, off-white, gray pages |
| Ink | Black | `#0A0A0A` | All text, icons, the act (C4) | Pure `#000` large fills next to photos (too harsh) |
| Ink, second | Black 55% | `rgb(10 10 10 / .55)` | Secondary text, the second phrase of a heading | Gray hex values; anything under 13 px at this level |
| Ground | Cool gray | `#EFF1F2` (sampled, ref-12 and ref-15) | Secondary fills, photo tiles while loading | Text |
| Field | Sky | `#90D1EF` / `#4EBAF7` | C2, the state "new" | Text, lines, icons on white (1.67 and 2.17:1) |
| Field | Mint | `#88DCB9` | C2, the state "live" | Same |
| Field | Lime | `#E6EA6A` | C2, the money highlight (C6), the state "sold" | Same (1.29:1) |
| Field | Peach | `#FBB383` | C2 corner only | Anywhere else |
| Category | Marigold, coral, lilac | `#F9C76F`, `#EF956E`, `#B08DF1` (sampled, jpg(12)) | Telling kinds of things apart (collections, post series) | State; mixed with the field in one view |
| Alert | Brick | `#C52B17` (sampled, Taskello) | Failed, the count of things that need you | Buttons, headlines, decoration (white on it 5.6:1; black on it fails) |

Rules:
1. **Color is a ground, never ink.** Every non-black color is a fill behind black text. Black on every field color passes 9:1. No colored text, colored lines or colored icons on white, except platform logos (C5) and the alert brick.
2. **Color covers at most a third of any view.** Measured as the share of pixels that are not white, black, gray or photo. The references sit at 12% (ref-12), 25% (Sana) and up to 50% (Docket); a third is the ceiling.
3. **State colors keep their familiar meanings.** Mint is live, lime is sold or paid, marigold needs you, brick failed, gray ended. Sky is new. A color means one thing everywhere.
4. **Photos bring their own color.** When a view has item photos, the field shrinks or moves away from them; it never sits behind a photo.

### Article 6. Type

Ben, 20:17: "im still not set on the fonts. i think you need to justify all text." So every type choice below carries its reason, and the open choices are in the kit.

**What each role has to do, before any typeface is chosen:**

| Role | Job | Hard requirements |
|---|---|---|
| Text | Everything people read: listing titles, prices, buttons, messages, captions | Accents and symbols for real listing titles (é ñ × ° ″ ½ –); tabular figures; clear at 13 px; feels native beside iOS; covers Latin, Cyrillic and Greek, with a named fallback for other scripts |
| Display | The wordmark, one heading per view, one big number per view | Has a voice that is not the default grotesk every AI app uses; a Book or Regular weight that holds at 28 to 50 px; an italic for a second phrase if we use that move |

**Candidates and reasons (agent proposal; Ben picks in the kit):**

| Face | Role | For | Against |
|---|---|---|---|
| **Geist** | Text | Ben's harness default; free; tabular figures; wide script coverage; reads like San Francisco so the app feels native | Common in developer tools, so alone it says "tech" |
| Neue Montreal | Text | Ben's QOVES brief; slightly warmer than Geist | The free cut has no Book weight and thinner coverage |
| **Marist Book** | Display | Ben's 19:56 pick; a serif voice breaks the "every AI app is a grotesk" tell (E5); Book italic gives the second-phrase move without bold | Only for display: a serif in 13 px UI text is wrong on a phone; trial files |
| Geist or Neue Montreal at Regular | Display | One family throughout, like the sky + lime references (all sans); the calmest option | Less recognizable (E4) |
| Clofie | Display only | Geometric and friendly | 103 glyphs, no accents: never for anything users write or listing titles |

**Banned:** Inter, even as a fallback (Ben's harness rule). Faux bold and faux italics. More than two families in one output. Uppercase mono labels as a style (Ben, 19:59: "completely fine not doing a mono font"); use the text face in sentence case.

**Setting rules (these hold whatever faces win):**
1. **Two weights.** Regular (or Book) for everything; Medium only for button labels and the selected tab. No bold anywhere. Hierarchy comes from size and the two ink levels, never from weight. (QOVES; Ben's brief. This removes the "janky bolding" of round 3, where a medium item title sat next to regular text of nearly the same size.)
2. **Few sizes, far apart.** App: 13, 15, 18, 22, 34 (and 50 for one number on a peak moment such as a sale). Adjacent steps differ by at least 15%, so a step reads as intended, not as a mistake (15 to 17 is only 13%, which is why the headline is 18). Web and post sizes scale by the medium table in Part III.
3. **Leading tightens as size grows.** 1.33 at 13 to 18 px, 1.15 at 22 px, 1.05 at 34 px, 0.95 at 50 px and up (Ben's Marist spec).
4. **Tracking tightens as size grows.** 0 at 13 to 15 px; −0.01em at 18 and 22; −0.015em at 34; −0.02em at 50 and up.
5. **Sentence case everywhere.** No title case, no all caps except the platform's own logos.
6. **Second phrase, not bold.** A heading may have a second phrase at black 55% or in the display italic. 22 px and up only.
7. **Numbers are tabular** wherever they line up or change.

**Any language.** The same rules hold in every language: sentence case, two weights, the size steps, no exclamation marks, no em dashes. When a script is not covered by the text face, fall back to Noto Sans in that script at the matching weight, and check that line breaks still fall between words or phrases, not inside them. Numbers, dates and currency follow the locale (`Intl.NumberFormat`), never a hard-coded US format. The display face is never used for a script it does not cover; the text face takes the role instead.

### Article 7. Space and layout

1. **One scale.** 4, 8, 12, 16, 20, 24, 32, 48, 64. No other gaps.
2. **Inside is tighter than between.** Parts of one thing sit 4 to 12 apart; separate things 12 to 16; sections 24 to 48. If two gaps are equal, the eye cannot tell what belongs together.
3. **Group with space, not boxes.** No box inside a box. A card holds one thing; a section holds cards; nothing else frames anything.
4. **One focal point per view** (E1), then the next action.
5. **Alignment is on one left edge** per column. Centered text only for the wordmark (C1), single-line headings on posts and end cards.
6. **True scale.** App mockups are 390 × 844 pt and are judged at that size on Ben's MacBook (1512 × 982 pt, Retina). Generated UI at 1.5× scale is the most common image-model failure; attach a true-scale render as the anchor.

### Article 8. Imagery

1. **Photos of real things**, shot like a careful person with a phone: daylight, plain ground (wood floor, white sheet, concrete, a wall), the object large and slightly off center, honest wear visible.
2. **No people in item photos**, no hands unless the hand gives scale, no lifestyle scenes, no stock models.
3. **No illustration** of products, no mascots, no 3D blobs, no abstract AI art.
4. **Generated images** are allowed for mockups and demos only, stored in `assets/demo-items/`, and never presented as a real listing or a real user's item.
5. **Relit studio photos** (the product's own feature) are always shown next to the real photo, never instead of it (vision, Open).

### Article 9. Shape, depth and texture

1. **Radius scale:** 8 (photos inside cards), 14 (cards), 20 (sheets), pill (buttons, chips). Inner radius is outer radius minus the padding, never larger.
2. **Depth:** one of two, chosen per medium and kept: hairline rules (1 px black at 8%) or one soft shadow (`0 1px 2px` plus a wide faint blur). Never both on one surface, never colored glows on white, never glass.
3. **Texture only on the field** (C2): grain or mesh lines. Nowhere else.

### Article 10. Icons and logos

1. Hugeicons Stroke Rounded, 1.5 px stroke at 24 px, black or black 55%. One icon set per output. No Lucide or lookalikes (Ben's harness rule).
2. An icon never stands alone where a word is clearer, except the five tab icons and universally known glyphs (share, more, close).
3. No icon-topped cards (a big icon above a title above a paragraph): the most common AI layout.
4. Platform logos follow C5.

### Article 11. Motion, sound and time

App motion is governed by [frontend-standard.md §3](../product/frontend-standard.md). For every other medium:
1. **Motion shows cause and effect** (an item photo becomes a listing on five sites; a tile moves to Sold). Nothing moves for decoration.
2. **Cuts, not swooshes.** Hard cuts on the beat; a 200 to 300 ms ease-out where something must travel. No spins, bounces, zoom blurs or glitch effects.
3. **On-screen text holds long enough to read:** 0.3 s per word plus 1 s, minimum 1.5 s.
4. **Sound:** real room sound and UI sounds from the app; music without vocals under speech; no whooshes or risers.
5. **No loops of the field.** The gradient may drift once across a whole video, never pulse.

### Article 12. Voice

How secondhand sounds, in every medium and language. The rules for app strings are in [copy.md](../product/copy.md) and the UI constitution; this article covers voice everywhere else (site, posts, video, deck).

1. **Plain words a person would say across a table.** If a stranger could not say what a line means back to you, rewrite it (E3).
2. **Numbers mean something.** "Similar ones sold for $36 to $52", not "n=41". "You keep $46.95", not "Net: 46.95".
3. **No chatter.** No greetings, taglines, motivational lines, "AI-powered", "seamless", "unlock". A feeling is carried by the design, never stated (copy.md C7).
4. **Short.** Headlines under 8 words, captions under 2 sentences, buttons a verb and an object.
5. **No exclamation marks, no em dashes, no emoji** as decoration, in any language.
6. **Never invent** a number, a customer, a quote or a result. A slot without a source stays visibly empty.

### Article 13. Not AI-made

Each AI tell is paired with what to reach for, because banning one default moves the output to the next likeliest one (ui-factory). A single hit is a question; a cluster is a failure.

| Tell | Reach for |
|---|---|
| Purple or blue-to-purple gradients, sparkles, glowing orbs | The textured field (C2), held to one band |
| A flat two-stop CSS gradient | The sampled mesh with grain or lines |
| Inter, or one grotesk everywhere at three weights | The type rules in Article 6 |
| Bold headings with a gray subtitle paragraph under them | One heading with a second phrase; no subtitle |
| Icon-topped feature cards in a row of three | One real example of the thing, with its photo |
| Glassmorphism, frosted blur, neon glow shadows | Hairlines or one soft shadow (Article 9) |
| Box inside a box inside a box | Space as the grouping (Article 7) |
| Pills and badges that say nothing ("New", "AI", "Beta") | State pills that mean one thing (Article 5.3) |
| Stats with jargon ("n=41", "92% confidence") | The number in a sentence a person would say |
| Stock people smiling at laptops, 3D illustrations | Real item photos (Article 8) |
| Greeting copy, "Welcome back", "Here's what's on your plate" | Nothing, or the user's own items |
| Centered everything, symmetric three-column layouts | One left edge, one focal point |
| Perfectly even spacing with no grouping | Inside tighter than between (Article 7.2) |
| Everything rounded to 16 or 24 px | The radius scale (Article 9.1) |
| Fake metadata, lorem ipsum, "Jane Doe", round numbers | Realistic, specific content: "Carhartt Detroit jacket, M", "$38" |

**The default test.** For any new kind of output, first generate or imagine the no-brand default (what a model makes from the brief with no brand). Put it next to your output. If they match on three or more of these, revise: palette, type, layout grid, card shape, icon style, copy pattern, image style.

### Article 14. Applying the brand to something new

1. **Name the end.** Which of E1 to E6 does this output serve most? (A sale screen serves E1 and E2; a launch post serves E4.)
2. **Pick the codes the medium can carry** (Part III table). Every output uses C1 and at least one of C2 or C3.
3. **Map the values** with the medium table (sizes, margins, safe areas).
4. **Make three cheap variants** that differ on one named axis (for example: where the field sits). Ben directs by reacting (thesis §0.3), so show him variants, not a single answer.
5. **Run the checks** in Part IV and write the reason ledger (Article 1).
6. **Show it at true size** in its real context: a phone screen at 390 pt, a post in an Instagram grid, a video on a phone.

---

## Part III. Media

| | App | Website | Instagram post / carousel | Story / Reel / video | Pitch deck |
|---|---|---|---|---|---|
| Canvas | 390 × 844 pt | 1440 wide desktop, 390 mobile | 1080 × 1350 | 1080 × 1920 | 1920 × 1080 |
| Margins | 20 | 24 mobile, 64 desktop, 1200 max content | 72 | 96 sides; keep 250 top and 340 bottom clear of UI | 96 |
| Wordmark (C1) | Nav bar, centered, 20 to 22 px | Header left; footer large | Top or bottom center, 40 px, same place in a series | End card, centered, 120 px | Title slide and last slide only |
| Field (C2) | The one card or band that needs you | The hero band | Background of one panel per carousel, or one band | One scene or the end card | Title slide and one key slide |
| Item (C3) | Every item row and card | Real items in every example | The item is the post | Real item footage | Real screenshots and photos |
| Act (C4) | One per decision | One per section | None (posts don't have buttons); a plain line instead | None | None |
| Text sizes | 13 / 15 / 18 / 22 / 34 / 50 | 15 / 17 / 22 / 36 / 58 / 86 (Ben's Marist spec, fluid) | Body 40, heading 72, one number up to 200 | Captions 48, titles 96 | Body 32, heading 64, one number up to 200 |
| Longest text | One sentence per card | Two short paragraphs per section | 20 words per slide | 8 words on screen at once | 15 words per slide |

Post and video notes:
- A carousel tells one story per slide in order: the item, what it is worth, where it sold, what you kept.
- Video uses the app's own screens at true scale inside the frame, never a fake device mockup with hands.
- Captions are the voice in Article 12. Hashtags only if they are real search terms, at the end, at most 3.

---

## Part IV. Checks

Each rule has an id, a check, and who runs it. **Script** means a deterministic check an agent writes and runs on the rendered output (DOM, pixels or the edit timeline). **Look** means a single human or fresh-agent glance. Brand feel always goes to Ben.

| Id | Rule | Check | Runs |
|---|---|---|---|
| B1 | Every element has a reason (Art. 1) | Reason ledger has zero blanks | Look |
| B2 | Squint test (E1) | Blur the render 8 px; the first visible mass is an item photo or an amount | Look |
| B3 | Wordmark lowercase, placed by medium (C1) | Text content equals "secondhand"; app: centered in nav bar ±1 px | Script |
| B4 | One field per view (C2) | Count elements using the field token; must be ≤ 1 | Script |
| B5 | Field has texture (C2) | The field element has a grain or mesh layer | Script |
| B6 | Black text on field and color (Art. 5.1) | Every text node over a non-white fill is black or white-on-brick only; contrast ≥ 4.5:1 | Script |
| B7 | No colored text, lines or icons on white (Art. 5.1) | Computed `color`, `border-color`, SVG `stroke` on white grounds are black or black 55%, except logos and brick | Script |
| B8 | Color ≤ one third of the view (Art. 5.2) | Pixel share that is non-neutral and non-photo ≤ 33% | Script |
| B9 | Every item has a photo (C3) | Every item element contains an `img` with a non-empty `alt` | Script |
| B10 | One black pill per decision (C4) | Count primary buttons per card ≤ 1 | Script |
| B11 | Logos not names (C5) | No marketplace name as visible text where a logo slot exists; logo `aria-label` present | Script |
| B12 | Money: tabular, labelled, one highlight (C6) | Money nodes have `tabular-nums`; ≤ 1 highlight per view; each amount has a label within its group | Script |
| B13 | Two weights only (Art. 6.1) | Computed `font-weight` values ⊆ {400, 500}; 500 only on buttons and the selected tab | Script |
| B14 | Size steps only (Art. 6.2) | Computed font sizes ⊆ the medium's set | Script |
| B15 | No banned faces (Art. 6) | Computed `font-family` contains no Inter; loaded fonts match the picks | Script |
| B16 | Sentence case (Art. 6.5) | No string, other than logos and proper nouns, is all caps or title case | Script |
| B17 | Spacing scale (Art. 7.1) | Every margin, padding and gap ∈ {0, 4, 8, 12, 16, 20, 24, 32, 48, 64} | Script |
| B18 | Inside tighter than between (Art. 7.2) | For each card, max internal gap < gap to its sibling | Script |
| B19 | No box in a box (Art. 7.3) | No bordered or filled element inside another bordered or filled element, except photos and buttons | Script |
| B20 | Radius scale (Art. 9.1) | Border radii ⊆ {0, 8, 14, 20, 999} | Script |
| B21 | One depth system (Art. 9.2) | Not both borders and shadows on cards in one view | Script |
| B22 | One icon set (Art. 10) | All icons from Hugeicons Stroke Rounded | Script |
| B23 | Words (Art. 12; copy.md) | `node scripts/copy-lint.mjs` clean or each hit justified; no `!`, `—` or emoji | Script |
| B24 | Numbers a person can say back (E3) | Read each number aloud with its label to someone new; they can explain it | Look |
| B25 | Default test (Art. 13) | Side by side with the no-brand default; fewer than 3 matching axes | Look |
| B26 | Video text holds (Art. 11.3) | Each on-screen text duration ≥ 0.3 s per word + 1 s | Script on the timeline |
| B27 | Locale (Art. 6) | Money and dates rendered through the locale formatter; no hard-coded "$" in strings | Script |
| B28 | True scale (Art. 7.6) | App renders are 390 × 844 pt; images judged at 390 CSS px wide | Script |
| B29 | Feel | Ben looks at it | Ben |

A check that passes is not proof of taste ("scripts can't prove it looks good"). It is proof the rules were followed. Record results with the output.

---

## Part V. Changing this file

1. Ends (Part I) and codes (Article 4) change only on Ben's word. Log his exact words in [product/words.md](../product/words.md) and the decision in [product/decisions.md](../product/decisions.md).
2. A correction from Ben is recorded word for word, generalized to the class of thing it is about, and offered as a check in Part IV. It becomes a standing rule only when he says yes. Not every problem becomes a rule.
3. Values change in `tokens.css` and in the tables here in the same commit.
4. A rule that turns out to fight an end is fixed here, never overridden in a component.
