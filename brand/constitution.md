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

**Status.** Article 1 is Ben's words and binds now. The ends in Part I are drawn from his words and are marked where they are my reading. Every concrete value (a hex, a typeface, a size) is an *agent proposal* until Ben picks it. What is locked and what is open is in [ledger.md](ledger.md). His pick replaces the proposal here and in `tokens.css` in the same commit.

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
| jpg(12) (Docket notes) | **Color as category.** | Flat fills from the same family (marigold, coral, lilac) used to tell kinds of things apart. Black round controls on color. Generous crop. | Rounded geometric display type, candy saturation everywhere |
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
- Text on the field is black only. Every field color passes 9:1 with black and fails 3:1 with white. State pills on the field are white with a black label, so they don't vanish into it.
- Boundary: never full-screen in the app, never as a border or text fill, never two fields touching, never animated as a loop.

**C3. The item leads.** Every item is shown by its photo, and the photo is the largest image in its group. A real photo of the real thing, in daylight, on a plain ground. Ben, 20:17: "for a carhartt jacket, you should probably have a picture of it."
- Boundary: no item without a photo (use a neutral tile with the category icon only while the photo loads); no illustration of an item; generated photos only in demos, marked as such.

**C4. The black pill is the act.** The one action that moves things forward is a black pill with white text. One per decision, and on the app at most one per card.
- Boundary: never red, never on the field in anything but black, never two black pills side by side.

**C5. Platform logos, not names.** Where a marketplace is meant, its real logo is shown, from [assets/platforms/](../assets/platforms/). Ben, 19:59.
- Boundary: unaltered logos only, brand color or black, never redrawn letterforms. VoiceOver and alt text carry the name.

**C6. Plain money.** Amounts are set in the text face with tabular figures, with the currency sign, at the same size as the text around them or one step up. The one peak amount per view (a sale) may be 50 in the app or up to 200 in a post or deck, still in the text face (agent proposal; open as D6 in the [ledger](ledger.md)). The amount you keep is the one number that gets the lime highlight (a band behind the lower 40% of the figures).
- Boundary: one highlight per view, never inside the field (on the field, the amount stands out by size); never a counter animation; never a big number without what it is ("$46.95" alone fails; "You keep $46.95" passes).

### Article 5. Color

| Role | Name | Value (proposal) | Use | Never |
|---|---|---|---|---|
| Page | White | `#FFFFFF` | Every page, screen and post ground | Cream, off-white, gray pages |
| Ink | Black | `#0A0A0A` | All text, icons, the act (C4) | Pure `#000` large fills next to photos (too harsh) |
| Ink, second | Black 65% | `rgb(10 10 10 / .65)` | Secondary text on white and gray (6.1:1 and 5.4:1) | Gray hex values; any field, state or category fill; anything under 13 px |
| Ground | Cool gray | `#EFF1F2` (sampled, ref-12) | Secondary fills, photo tiles while loading | Text |
| Field | Sky | `#90D1EF` / `#4EBAF7` | C2 (`#4EBAF7` is its deep corner), the state "shipping" | Text, lines, icons on white (1.67 and 2.17:1) |
| Field | Mint | `#88DCB9` | C2, the state "live" | Same |
| Field | Lime | `#E6EA6A` | C2, and money: the highlight (C6), the states "sold" and "paid" | Same (1.29:1) |
| Field | Peach | `#FBB383` | C2 corner only | Anywhere else |
| State | Marigold | `#F9C76F` (sampled, jpg(12)) | The state "needs you" | Category; decoration |
| Category | Coral, lilac | `#EF956E`, `#B08DF1` (sampled, jpg(12)) | Telling kinds of things apart (collections, post series) | State; mixed with the field in one view |
| Alert | Brick | `#C52B17` (sampled, Amigo and Home_X) | Failed; the confirm in a destructive sheet | Other buttons, headlines, decoration (white on it 5.6:1; black on it fails) |

Rules:
1. **Color is a ground, never ink.** Every field, state and category color is a fill behind black text (each passes 9:1). White text only on the black pill (C4) and brick. No colored text, colored lines or colored icons on white, except platform logos (C5), the alert brick and the unread dot. Text over a photo or footage sits on the field or a white bar, in black; never white with a shadow.
2. **Color covers at most a third of any view.** Measured as the share of pixels that are not white, black, gray or photo. The references sit at 12% (ref-12), 25% (Sana) and up to 50% (Docket); a third is the ceiling.
3. **A color means one thing everywhere.** Mint is live. Lime is money: sold, paid and the amount you keep. Marigold needs you. Sky is on its way. Brick failed. Gray ended. The full set, with every interaction state, is the table below.
4. **Photos bring their own color.** When a view has item photos, the field shrinks or moves away from them; it never sits behind a photo.

#### States (agent decision 2026-11-14, Ben can veto on round 6 board D1)

Every state a screen can show, decided once so no worker invents one. Fills take black text (contrast is black on the fill). Tokens are in [tokens.css](tokens.css).

| State | Shows as | Token | Contrast |
|---|---|---|---|
| Draft | White pill, hairline outline, gray text | `--rule`, `--ink-2` | 6.1:1 |
| Live | Mint fill | `--mint` | 12.2:1 |
| Needs you (an offer, a question, a deadline) | Marigold fill | `--marigold` | 12.7:1 |
| Sold | Lime fill | `--lime` | 15.4:1 |
| Shipping | Sky fill | `--sky` | 11.8:1 |
| Paid | Lime fill with a check icon | `--lime` | 15.4:1 |
| Failed | Pale brick fill, brick icon | `--brick-tint`, `--brick` | 17.2:1; icon 4.9:1 |
| Ended, expired, unsold | Gray fill, gray text | `--gray`, `--ink-2` | 5.4:1 |
| Unread | 8 px dot | `--sky-ink` | 4.0:1 on white |

| Interaction | Black pill | Outline button | Gray button | Other |
|---|---|---|---|---|
| Pressed | `--ink-press` | `--gray` fill | `--gray-press` | Scale 0.98, `--t-feedback` |
| Hover (web) | `--ink-press` | `--gray` fill | `--gray-press` | |
| Focus | 2 px ink ring, 2 px white gap | same | same | Every control; never removed |
| Selected | | | | Chips and segments: ink fill, white text (19.8:1). Tabs: ink, weight 500. Grid photos: 2 px ink ring and a check |
| Disabled | `--gray` fill, `--ink-disabled` text | same | same | Never the only sign; say why nearby |
| Loading | Spinner in place of the label, width kept | | | Skeletons are `--gray` |

Fields: hairline at rest, 1.5 px ink when focused, 1.5 px brick with a 13 px brick line under it when wrong. Nothing marks a field as right.
Overlays: scrim `--scrim`; sheets white at `--r-sheet`; toasts ink with white text, one at a time.
Destructive: the confirm in a destructive sheet is a brick pill with white text (5.6:1). Nowhere else is brick a button.
Tab badge: a marigold dot. No numbers.
Every state carries its icon as well as its color (Ben, [round 6](../product/words.md#2026-11-14-round-6-picks)): live a broadcast signal, needs you a raised hand, sold a banknote, shipping a parcel, paid a check, failed an alert, draft a pencil, ended a clock. Color is never the only sign.

**The family.** Every hue (sky, mint, lime, marigold, lilac, brick) has three steps and no others: a tint, the fill and a deep. They are built the same way in OKLCH (tint at lightness .955, deep at .42, the hue kept), which is what keeps them one family. Tints and fills take black text; deeps take white. A new color is a new hue run through the same three steps, never a hand-picked hex.

**Dark mode** (Ben, round 6: light is standard, dark is offered, the feel stays). Only the page, the surfaces and the ink flip. The field, the fills and black text on color are the same in both modes, so the brand reads the same. Values are in `tokens.css`.

The unread dot is the one colored mark allowed on white besides logos and brick, because the blue unread dot is what people already know from Mail and Messages ([words.md: familiar](../product/words.md)).

### Article 6. Type

Ben, 20:17: "im still not set on the fonts. i think you need to justify all text." So every type choice below carries its reason, and the open choices are in the kit.

**What each role has to do, before any typeface is chosen:**

| Role | Job | Hard requirements |
|---|---|---|
| Text | Everything people read: listing titles, prices, buttons, messages, captions | Accents and symbols for real listing titles (é ñ × ° ″ ½ –); tabular figures; clear at 13 px; feels native beside iOS; covers Latin, Cyrillic and Greek, with a named fallback for other scripts |
| Display | The wordmark and headings: in the app one heading per view; on the web Ben's three tiers (hero, section, feature) | Has a voice that is not the default grotesk every AI app uses; a Book weight that holds at 21 to 86 px; an italic for a second phrase if we use that move |

**Candidates and reasons (agent proposal; Ben picks in the kit):**

| Face | Role | For | Against |
|---|---|---|---|
| **Geist** | Text | Ben's harness default; free; tabular figures; looks the same in the app, on the web, in posts and in video (E4) | Common in developer tools, so alone it says "tech"; Latin and Cyrillic only, so other scripts fall to Noto |
| SF Pro (the iPhone system face) | Text | The platform default: native by definition, Dynamic Type for free, every script | Not available on the web or in posts outside Apple devices, so the brand looks different off the phone (E4) |
| Neue Montreal | Text | Ben's QOVES brief; slightly warmer than Geist | The free cut has no Book weight and thinner coverage |
| **Marist Book** | Display | Ben's 19:56 pick; a serif voice breaks the "every AI app is a grotesk" tell (E5); Book italic gives the second-phrase move without bold | Only for display: a serif in 13 px UI text is wrong on a phone; trial files |
| Geist or Neue Montreal at Regular | Display | One family throughout, like the sky + lime references (all sans); the calmest option | Less recognizable (E4) |
| Clofie | Display only | Geometric and friendly | 103 glyphs, no accents: never for anything users write or listing titles |

**Banned:** Inter, even as a fallback (Ben's harness rule). Faux bold and faux italics. More than two families in one output, not counting a Noto fallback for a script the text face lacks. Uppercase mono labels as a style (Ben, 19:59: "completely fine not doing a mono font"); use the text face in sentence case.

**Setting rules (these hold whatever faces win):**
1. **Two weights per face.** Display: Book (350) and its italic. Text: Regular (400), and Medium (500) only for button labels and the selected tab. No bold anywhere. Hierarchy comes from size and the two ink levels, never from weight. (QOVES; Ben's brief. This removes the "janky bolding" of round 3, where a medium item title sat next to regular text of nearly the same size.)
2. **Few sizes, far apart.** App: 13, 15, 18, 21, 36 and 50, by role in the table below. 21, 36 and 50 are Ben's Marist spec at 390 px wide. Adjacent steps differ by at least 15%, so a step reads as intended, not as a mistake (15 to 17 is only 13%, which is why the headline is 18). Web and post sizes scale by the medium table in Part III.
3. **Leading tightens as size grows.** Text: 13/18, 15/20, 18/24 (agent proposal). Display: 1.10 at 21, 1.05 at 36, 0.95 at 50 and up (Ben's ratios: 21/23.1, 36/37.8, 50/47.5). Devanagari, Thai and Arabic: at least 1.2 at every size.
4. **Tracking tightens as size grows.** 0 at 13 to 15 px; −0.01em at 18 to 36 (Ben: −0.2px at 21, −0.01em at 36); −0.02em at 50 and up (Ben). None in Chinese, Japanese or Korean.
5. **Sentence case everywhere.** No title case, no all caps except the platform's own logos.
6. **Second phrase, not bold.** A heading may have a second phrase at black 65% (on white or gray) or in the display italic (in black, on any ground). 21 px and up only.
7. **Numbers are tabular** wherever they line up or change.
8. **Sizes follow the person's text setting.** The sizes are the default-size values; on iOS they map to Dynamic Type (13 footnote, 15 subheadline, 18 body, 21 title2, 36 largeTitle) and grow with it. Line heights are ratios, so they grow too.

**Roles** (agent proposal; tokens in [tokens.css](tokens.css)):

| Role | Size | Face and weight | Ink |
|---|---|---|---|
| Caption, time, tab label | 13 | text 400 | ink-2 |
| Body, list row, price in a row, card title | 15 | text 400 | ink |
| Button label | 15 | text 500 | white on the pill, ink on the others |
| Headline in a card or sheet; text you type | 18 | text 400 | ink |
| Wordmark; feature heading | 21 | display 350 | ink |
| Screen heading, one per view | 36 | display 350 | ink |
| The peak amount on a sale | 50 | text 400, tabular (open: D6) | ink |

**Any language.** The same rules hold in every language: sentence case, two weights, the size steps, no exclamation marks, no em dashes. When a script is not covered by the text face, fall back to Noto Sans in that script at the matching weight (the stack is in `tokens.css`), and check that line breaks still fall between words or phrases, not inside them. Numbers, dates and currency follow the locale (`Intl.NumberFormat`), never a hard-coded US format. Length limits counted in words count 2 characters as a word in Chinese, Japanese and Korean. The display face is never used for a script it does not cover; the text face takes the role instead.

### Article 7. Space and layout

1. **One scale.** 4, 8, 12, 16, 20, 24, 32, 48, 64. No other gaps.
2. **Inside is tighter than between.** Parts of one thing sit 4 to 12 apart; separate things 12 to 16; sections 24 to 48. If two gaps are equal, the eye cannot tell what belongs together.
3. **Group with space, not boxes.** No box inside a box. A card holds one thing; a section holds cards; nothing else frames anything.
4. **One focal point per view** (E1), then the next action.
5. **Alignment is on one start edge** per column (left in left-to-right scripts, right in right-to-left; use logical properties). Centered text only for the wordmark (C1), single-line headings on posts and end cards.
6. **True scale.** App mockups are 390 × 844 pt and are judged at that size on Ben's MacBook (1512 × 982 pt, Retina). Generated UI at 1.5× scale is the most common image-model failure; attach a true-scale render as the anchor.

### Article 8. Imagery

1. **Photos of real things**, shot like a careful person with a phone: daylight, plain ground (wood floor, white sheet, concrete, a wall), the object large and slightly off center, honest wear visible.
2. **No people in item photos**, no hands unless the hand gives scale, no lifestyle scenes, no stock models.
3. **No illustration** of products, no mascots, no 3D blobs, no abstract AI art.
4. **Generated images** are allowed for mockups and demos only, stored in `assets/demo-items/`, and never presented as a real listing or a real user's item.
5. **Relit studio photos** (the product's own feature) are always shown next to the real photo, never instead of it (vision, Open).

### Article 9. Shape, depth and texture

1. **Radius scale:** 8 (photos inside cards), 14 (cards), 20 (sheets), pill (buttons, chips).
2. **Depth:** one of two, chosen per medium and kept: hairline rules (1 px black at 8%) or one soft shadow (`0 1px 2px` plus a wide faint blur). Never both on one surface, never colored glows on white, never glass.
3. **Texture only on the field** (C2): grain or mesh lines. Nowhere else.

### Article 10. Icons and logos

1. Hugeicons Stroke Rounded, 1.5 px stroke at 24 px, black or black 65%. One icon set per output. No Lucide or lookalikes (Ben's harness rule).
2. An icon never stands alone where a word is clearer, except the five tab icons and universally known glyphs (share, more, close).
3. No icon-topped cards (a big icon above a title above a paragraph): the most common AI layout.
4. Platform logos follow C5.

### Article 11. Motion, sound and time

App motion is governed by [frontend-standard.md §3](../product/frontend-standard.md). For every other medium:
1. **Motion shows cause and effect** (an item photo becomes a listing on five sites; a tile moves to Sold). Nothing moves for decoration.
2. **Cuts, not swooshes.** Hard cuts on the beat; a 200 to 300 ms ease-out where something must travel. No spins, bounces, zoom blurs or glitch effects.
3. **On-screen text holds long enough to read:** 0.3 s per word (per 2 characters in Chinese, Japanese and Korean) plus 1 s, minimum 1.5 s.
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
| A view is | One screen at one scroll position, or one sheet | One viewport at one scroll position | One slide | One frame | One slide |
| Margins | 20 | 24 mobile, 64 desktop, 1200 max content | 72 | 96 sides; keep 250 top and 340 bottom clear of UI | 96 |
| Wordmark (C1) | Nav bar, centered, 21 px | Header left, 21 px; footer 86.5 px at 1440 | Top or bottom center, 40 px, same place in a series | End card, centered, 120 px | Title slide and last slide only |
| Field (C2) | The one card or band that needs you | The hero band | Background of one panel per carousel, or one band | One scene or the end card | Title slide and one key slide |
| Item (C3) | Every item row and card | Real items in every example | The item is the post | Real item footage | Real screenshots and photos |
| Act (C4) | One per decision | One per section | None (posts don't have buttons); a plain line instead | None | None |
| Text sizes | 13 / 15 / 18 / 21 / 36 / 50 | Display, Ben's Marist spec from 390 to 1440 wide: hero 50 to 86.5, section 36 to 58.3, feature 21 to 24.9 (`clamp()` between). Text 15 and 18 at every width | Body 40, heading 72, one number up to 200 | Captions 48, titles 96 | Body 32, heading 64, one number up to 200 |
| Longest text | One sentence per card | Two short paragraphs per section | 20 words per slide | 8 words on screen at once | 15 words per slide |

Post and video notes:
- A carousel tells one story per slide in order: the item, what it is worth, where it sold, what you kept.
- Video uses the app's own screens at true scale inside the frame, never a fake device mockup with hands.
- Captions are the voice in Article 12. Hashtags only if they are real search terms, at the end, at most 3.

---

## Part IV. Checks

Each rule has an id, a check, and who runs it. **Script** means a deterministic check an agent writes and runs on the rendered output (DOM, pixels or the edit timeline). **Look** means a single human or fresh-agent glance. Brand feel always goes to Ben. **Not built** means the check is scriptable but no script exists yet, so it runs as a Look until one does. For an image or a video frame with no source file, every DOM check runs as a Look on the render at true size; checks that need source (B13, B15, B22, B27) are reported as not applicable.

| Id | Rule | Check | Runs |
|---|---|---|---|
| B1 | Every element has a reason (Art. 1) | Reason ledger has zero blanks and no reason from the list in Art. 1.2 | Look |
| B2 | Squint test (E1) | Blur the render 8 px; the first visible mass is an item photo or an amount (except outputs whose job is brand recognition) | Look |
| B3 | Wordmark lowercase, placed by medium (C1) | Text content equals "secondhand"; app: centered in nav bar ±1 px | Not built |
| B4 | One field per view (C2) | Count elements using the field token; must be ≤ 1 | Not built |
| B5 | Field has texture (C2) | The field element has a grain or mesh layer | Not built |
| B6 | Text contrast (Art. 5.1) | Every text node ≥ 4.5:1 with what is behind it (≥ 3:1 at 24 px and up). On field, state and category fills, text is ink only. White text only on the black pill and brick | Not built |
| B7 | No colored text, lines or icons on white (Art. 5.1) | Computed `color`, `border-color`, SVG `stroke` on white grounds are black or black 65%, except logos, brick and the unread dot | Script (colors in source only) |
| B8 | Color ≤ one third of the view (Art. 5.2) | Pixel share that is non-neutral and non-photo ≤ 33%; translucent black counts as black | Not built |
| B9 | Every item has a photo (C3) | Every item element contains an `img` with a non-empty `alt` | Not built |
| B10 | One black pill per decision (C4) | Count primary buttons per card ≤ 1 | Not built |
| B11 | Logos not names (C5) | No marketplace name as visible text where a logo slot exists; logo `aria-label` present | Not built |
| B12 | Money: tabular, labelled, one highlight (C6) | Money nodes have `tabular-nums`; ≤ 1 highlight per view; each amount has a label within its group; the highlight is not inside the field | Not built |
| B13 | Two weights per face (Art. 6.1) | Computed `font-weight` values ⊆ {350, 400, 500}; 350 only in the display face; 500 only on buttons and the selected tab | Script (the set only) |
| B14 | Size steps only (Art. 6.2) | At the default text size, computed sizes ⊆ the medium's set. Web: at 390 and 1440 wide each display size equals its endpoint, and text sizes ⊆ {15, 18}. The wordmark is exempt (its size is in Part III) | Not built |
| B15 | No banned faces (Art. 6) | Computed `font-family` contains no Inter; loaded fonts match the picks | Script (no literal font names in source) |
| B16 | Sentence case (Art. 6.5) | No string, other than logos and proper nouns, is all caps or title case | Not built |
| B17 | Spacing scale (Art. 7.1) | Every gap inside a component ∈ {0, 4, 8, 12, 16, 20, 24, 32, 48, 64}; canvas margins and safe areas come from Part III | Script |
| B18 | Inside tighter than between (Art. 7.2) | For each card, max internal gap < gap to its sibling | Not built |
| B19 | No box in a box (Art. 7.3) | No bordered or filled element inside another bordered or filled element, except photos, buttons, state pills and the money highlight | Not built |
| B20 | Radius scale (Art. 9.1) | Border radii ⊆ {0, 8, 14, 20, 999} | Script |
| B21 | One depth system (Art. 9.2) | Not both borders and shadows on cards in one view | Not built |
| B22 | One icon set (Art. 10) | All icons from Hugeicons Stroke Rounded | Not built |
| B23 | Words (Art. 12; copy.md) | `node scripts/copy-lint.mjs` clean or each hit justified; no `!`, `—` or emoji | Script |
| B24 | Numbers a person can say back (E3) | Read each number aloud with its label to someone new; they can explain it | Look |
| B25 | Default test (Art. 13) | Side by side with the no-brand default; fewer than 3 matching axes (an axis matches when a fresh agent would call the two the same choice) | Look |
| B26 | Video text holds (Art. 11.3) | Each on-screen text duration ≥ 0.3 s per word (2 characters in CJK) + 1 s | Not built |
| B27 | Locale (Art. 6) | Money and dates rendered through the locale formatter; no hard-coded "$" in strings | Not built |
| B28 | True scale (Art. 7.6) | App renders are 390 × 844 pt; images judged at 390 CSS px wide | Not built |
| B29 | Feel | Ben looks at it | Ben |

A check that passes is not proof of taste ("scripts can't prove it looks good"). It is proof the rules were followed. Record results with the output.

---

## Part V. Changing this file

1. Ends (Part I) and codes (Article 4) change only on Ben's word. Log his exact words in [product/words.md](../product/words.md) and the decision in [product/decisions.md](../product/decisions.md).
2. A correction from Ben is recorded word for word, generalized to the class of thing it is about, and offered as a check in Part IV. It becomes a standing rule only when he says yes. Not every problem becomes a rule.
3. Values change in `tokens.css` and in the tables here in the same commit.
4. A rule that turns out to fight an end is fixed here, never overridden in a component.
