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
| QOVES case study | **Type setting.** | One sans for everything in two weights, medium only on buttons, two luminances instead of bold, small labels | Its clinical palette |
| Quechua, ref-22 | **Product photography.** | Real products on stone and plain grounds, daylight, the object large in frame | Outdoor lifestyle scenes |
| Amigo, Home_X | **One warm signal.** | A single brick red for alerts | Its use of brick as a page color |

Avoid as sources: AI concept galleries for anything beyond color and mood (most of the Dribbble shots are concepts, so their layouts are unproven), painted illustration, frosted glass, cream instead of white. In step 1, ref-12 and jpg(12) were marked "rainbow mesh" and "candy" to avoid. Ben's 20:17 message overrides that: the gradient is in, held to one field per view (Code C2).

When a new reference is added: name its one job, say whether it is a requirement or a weak signal, and add a row here.

### Article 4. The codes

The few signature assets that make secondhand recognizable (E4). Each has an exact value in `tokens.css` and a boundary. Every output uses the codes that its medium can carry (see Part III) and no codes that are not on this list.

**C1. The wordmark.** "secondhand", all lowercase, one word, set in Clofie SemiBold (Article 6; Ben, [round 8](../product/words.md#2026-11-15-round-8-picks)), black on white or on the field.
- App: centered at the top of every main screen, in the navigation bar. Ben, 20:17: "the secondhand wordmark should be right at the top, centered."
- Web: top left in the header at 21, and once in the footer at `--t-section`.
- Post: top center or bottom center, at 3% of the frame's height, the same place on every post in a series.
- Deck: bottom left of every slide at 32, and alone at the heading size on the closing slide. No slide sets the wordmark and a heading at one size, because both are Clofie and the wordmark would read as a heading (agent proposal, R26).
- Video: the end card only, centered, held for at least 1.5 s.
- Boundary: never in a sentence, never capitalized, never with a tagline attached, never smaller than 14 px (app) or 3% of frame height (video), never recolored except black or white.
- The kit (agent proposal, round 10, from [brand-systems-from-studios.md](../research/cross-cutting/ben/brand-systems-from-studios.md); open in the [ledger](ledger.md) as R26). One unit is half the wordmark's type size. Nothing but its ground sits within one unit of it on any side. It is live text in the display face, never an image and never redrawn. It is never transformed, shadowed, outlined, stroked, filtered or faded, has no fill or box of its own, never moves, never sits on a photo, and appears once per view. If Ben keeps the second hand (R20), the hand is part of the wordmark and is the one thing allowed inside that space and the one part that moves.

**C2. The field.** A soft mesh of three colors from the ring (Article 5) that sit near each other. Home is sky, mint and lime, the heart of the brand. It is the brand's one color event. What Ben likes is its pattern and feel more than its exact colors ("the lighter ones", [round 7](../product/words.md#2026-11-15-round-7-picks)).
- A set, by rule (Ben, [round 8](../product/words.md#2026-11-15-round-8-picks): "A set but a larger set"). Three colors from the ring make a field when no two of them are near opposite each other (agent proposal: at most 140 degrees apart on the wheel, which allows 24 fields). Nothing else does: never dark or saturated, never opposites (they meet in mud), never hard stops, never two flat stops, never more than three colors.
- One field changes into the next by one step along the ring: one of its three colors is swapped for that color's neighbor (Ben, [round 8](../product/words.md#2026-11-15-round-8-picks): "a gradient changing into another gradient into another"). Fields are written in code from the tokens, never as images. Which fields get a name and a job is open in the [ledger](ledger.md).
- One field per view: one card, one band, one panel, one frame.
- It is soft: several blurred points of color, with no lines and no grain (Ben, rounds 6 and 7).
- It drifts and is never static: one pass takes `--drift` (26 s, open as R17), eased, and it runs there and back, so no frame repeats within 52 s (Ben, [round 7](../product/words.md#2026-11-15-round-7-picks): "super ambient but not static").
- It sits behind the most important thing (the decision that needs you, the hero of a web page, the one stat in a post), never behind long text.
- Text on the field is black only. Every field color passes 13:1 with black and fails 3:1 with white. State pills on the field are white with a black label, so they don't vanish into it.
- At rest in the app it is one card. On a sale, the biggest moment, it fills the whole screen once as an animation, with a haptic and a sound (Ben, [round 7](../product/words.md#2026-11-15-round-7-picks)).
- Boundary: never a border or text fill, never two fields touching.
- Where the medium cannot move (a post, a printed deck, a sticker), the field is one frozen frame of the same code (agent proposal, R26).

**C3. The item leads.** Every item is shown by its photo, and the photo is the largest image in its group. A real photo of the real thing, in daylight, on a plain ground. Ben, 20:17: "for a carhartt jacket, you should probably have a picture of it."
- Boundary: no item without a photo (use a neutral tile with the category icon only while the photo loads); no illustration of an item; generated photos only in demos, marked as such.

**C4. The black pill is the act.** The one action that moves things forward is a black pill with white text. One per decision, and on the app at most one per card. It is never flat pure black: it has a little depth (Ben, [round 7](../product/words.md#2026-11-15-round-7-picks): "slight variations to black", "a little more depth or a slight shadow"). The depth is a faint glow of sky and lime under the pill, `--pill-glow` (Ben, [round 8](../product/words.md#2026-11-15-round-8-picks)). Ben, [round 10](../product/words.md#2026-11-15-round-10-picks), asked whether the black is too heavy and why the outline is the only black line: which box gets the pill when a view holds two decisions, and what the second button looks like, are open in the [ledger](ledger.md) as R33 and R34.
- Boundary: never red, never on the field in anything but black, never two black pills side by side.

**C5. Platform logos, not names.** Where a marketplace is meant, its real logo is shown, from [assets/platforms/](../assets/platforms/). Ben, 19:59.
- Boundary: unaltered logos only, brand color or black, never redrawn letterforms. VoiceOver and alt text carry the name.
- In a row, logos share one height and one gap, and none is taller than the wordmark's type size. In the app, a logo that stands where a photo would be, for a thing that has no photo, sits alone in the photo's 72 slot at 40. Corners stay as the file has them: rounding a logo alters it (agent proposal, R26). A logo sits on white, or on a white plate: eBay's file has an off-white ground, and Ben saw it blend into the receipt's gray ([round 10](../product/words.md#2026-11-15-round-10-picks)).

**C6. Plain money.** Amounts are set in the text face, with the currency sign, at the same size as the text around them or one step up. The one peak amount per view (a sale) may be 50 in the app or up to 200 in a post or deck, still in the text face (agent proposal). Tabular figures follow Article 6.7. No band or highlight sits behind an amount: it stands out by size alone, and one kind of amount looks the same everywhere it appears (Ben, [round 7](../product/words.md#2026-11-15-round-7-picks)).
- Boundary: never a counter animation; never an amount at 36 or larger without the words that say what it is ("$46.95" alone fails; "You keep $46.95" passes).

### Article 5. Color

| Role | Name | Value (proposal) | Use | Never |
|---|---|---|---|---|
| Page | White | `#FFFFFF` | Every page, screen and post ground | Cream, off-white, gray pages |
| Ink | Black | `#0A0A0A` | All text, icons, the act (C4) | Pure `#000` large fills next to photos (too harsh) |
| Ink, second | Black 65% | `rgb(10 10 10 / .65)` | Secondary text on white and gray (6.1:1 and 5.4:1) | Gray hex values; any field, state or category fill; anything under 13 px |
| Ground | Cool gray | `#EFF1F2` (sampled, ref-12) | Secondary fills, photo tiles while loading | Text |
| State | Sky | `#A5E1FE` | The state "live"; C2 | Text, lines, icons on white (under 1.5:1) |
| State | Mint | `#A1EACB` | The state "sold"; C2 | Same |
| State | Lime | `#EBF08F` | The state "paid"; C2 | Same |
| State | Marigold | `#F5D297` | The state "needs you"; C2 | Category; decoration |
| State (open, R28) | Lilac | `#DDCEFE` | The state "shipping", until Ben picks; C2 | Same |
| Category | Pink | `#FEC6D2` | Telling one kind of thing apart from the rest (a collection, a post series); C2 | State |
| Field only | Aqua, peach | `#91EAE9`, `#FECCAA` | C2 and nothing else: each sits too close to a color that means something (What separates, rule 5) | State; category |
| Alert | Brick | `#C52B17` (sampled, Amigo and Home_X) | Failed; the confirm in a destructive sheet | Other buttons, headlines, decoration (white on it 5.6:1; black on it fails) |

Rules:
1. **Color is a ground, never ink.** Every state and category color is a fill behind black text (each passes 13:1). White text only on the black pill (C4) and brick. No colored text, colored lines or colored icons on white, except platform logos (C5), the alert brick and the unread dot. Text over a photo or footage sits on the field or a white bar, in black; never white with a shadow.
2. **Color covers at most a third of any view.** Measured as the share of pixels that are not white, black, gray or photo. The references sit at 12% (ref-12), 25% (Sana) and up to 50% (Docket); a third is the ceiling. A view the field fills is exempt: the sale in the app (C2), one view in any other output, and two in a deck (agent proposal, R26).
3. **A color means one thing everywhere.** Sky is live. Mint is sold. Marigold needs you (Ben, [round 10](../product/words.md#2026-11-15-round-10-picks): "sold mint, live as in blue like twitch kinda, needs you yellow or lime as in like a warning"). Lime is paid. Brick failed. Gray ended. Shipping is lilac until Ben picks (R28). The full set, with every interaction state, is the table below.
4. **Photos bring their own color.** When a view has item photos, the field shrinks or moves away from them. The one exception is the thing the field is there for: the photo of the item in the field's own card, or in the sale that fills the screen, sits on the field with its own corner and edge, as in every offer card Ben has picked since round 7. The field never shows through a photo, never tints one, and never sits behind a grid of photos (agent proposal, R26).

#### States

Every state a screen can show, decided once so no worker invents one (agent decision A1, 2026-11-14; live, sold and needs you are Ben's, L39). Fills take black text (contrast is black on the fill). Tokens are in [tokens.css](tokens.css).

| State | Shows as | Token | Contrast |
|---|---|---|---|
| Draft | White pill, hairline outline, gray text | `--rule`, `--ink-2` | 6.1:1 |
| Live | Sky fill | `--sky` | 13.9:1 |
| Needs you (an offer, a question, a deadline) | Marigold fill | `--marigold` | 13.7:1 |
| Sold | Mint fill | `--mint` | 14.3:1 |
| Shipping (open, R28) | Lilac fill | `--lilac` | 13.5:1 |
| Paid | Lime fill with a check icon | `--lime` | 16.4:1 |
| Failed | Pale brick fill, brick icon. Ben, round 10: it blends in. A brick fill with white text is open as R30 | `--brick-tint`, `--brick` | 17.2:1; icon 4.9:1 |
| Ended, expired, unsold | Gray fill, gray text. Ben, round 10: it blends in. A darker gray with ink text, and the photo washed to 55%, is open as R30 | `--gray`, `--ink-2` | 5.4:1 |
| Unread | 8 px dot | `--sky-ink` | 4.0:1 on white |

| Interaction | Black pill | Outline button | Gray button | Other |
|---|---|---|---|---|
| Pressed | `--ink-press` | `--gray` fill | `--gray-press` | Scale 0.97, `--t-feedback`, as in [frontend-standard.md §3](../product/frontend-standard.md) |
| Hover (web) | `--ink-press` | `--gray` fill | `--gray-press` | |
| Focus | 2 px ink ring, 2 px white gap | same | same | Every control; never removed |
| Selected | | | | Chips and segments: ink fill, white text (19.8:1). Tabs: the filled icon in ink; the label keeps its weight (Ben, [round 10](../product/words.md#2026-11-15-round-10-picks)). Grid photos: 2 px ink ring and a check |
| Disabled | `--gray` fill, `--ink-disabled` text | same | same | Never the only sign; say why nearby |
| Loading | Spinner in place of the label, width kept | | | Skeletons are `--gray` |

Fields: hairline at rest, 1.5 px ink when focused, 1.5 px brick with a 13 px brick line under it when wrong. Nothing marks a field as right.
Overlays: scrim `--scrim`; sheets white at `--r-sheet`; toasts ink with white text, one at a time.
Destructive: the confirm in a destructive sheet is a brick pill with white text (5.6:1). Nowhere else is brick a button.
Tab badge: a marigold dot. No numbers.
State on a photo: a corner tag in a soft gradient of the state's color, tint to fill, with the icon and the word in black (Ben, [round 7](../product/words.md#2026-11-15-round-7-picks)).
Notice card: gray, or marigold tint when it needs the person, with an x to dismiss (agent decision; Ben, [round 7](../product/words.md#2026-11-15-round-7-picks): "your choice"). Sky tint is not used, because sky means live.
Every state carries its icon as well as its color (Ben, [round 6](../product/words.md#2026-11-14-round-6-picks)): live a broadcast signal, needs you a raised hand, sold a banknote, shipping a parcel, paid a check, failed an alert, draft a pencil, ended a clock. Color is never the only sign.

**The family.** Eight light hues make a ring, in this order: lilac, sky, aqua, mint, lime, marigold, peach, pink, and back to lilac (Ben, [round 8](../product/words.md#2026-11-15-round-8-picks): the wider set under one rule). Each hue, and brick, has three steps and no others: a tint, the fill and a deep. They are built the same way in OKLCH with the hue kept: the tint at lightness .955 and chroma .045, the fill at .88 and .085, the deep at .42. Lime's fill is .93 and .12, because a yellow that dark reads as olive. Tints and fills take black text; deeps take white. A new color is a new hue run through the same steps, never a hand-picked hex. Whether the family gets a deeper step that is used is open in the [ledger](ledger.md) (Ben, [round 8](../product/words.md#2026-11-15-round-8-picks): "the palette could be lacking deeper colors?").

**Dark mode** comes later (Ben, [round 7](../product/words.md#2026-11-15-round-7-picks): "plan dark mode for later", and "light vs dark should be exclusively color changes"). Light is standard. When it is built, nothing but color changes: only the page, the surfaces and the ink flip. The field, the fills and black text on color are the same in both modes, so the brand reads the same. Values are in `tokens.css`.

The unread dot is the one colored mark allowed on white besides logos and brick, because the blue unread dot is what people already know from Mail and Messages ([words.md: familiar](../product/words.md)).

#### What separates (Ben, [round 10](../product/words.md#2026-11-15-round-10-picks): "Yes, this rule"; L40)

Ben, [round 9](../product/words.md#2026-11-15-round-9-picks): "the design system needs to identify when things feel like they blend together". The measurements are in [brand-round-10.md](../research/cross-cutting/ben/brand-round-10.md).

1. A surface is at least .04 from what it sits on, measured as the distance between the two colors in Oklab. Gray on white is .043, and five minutes after he locked this Ben wrote that the gray box under the Nike Dunks "doesn't feel as separate". So .04 is the floor for a control (a chip, the + tab), and a box that holds content needs more: that is open as R29.
2. Tints sit on white only. On gray they are .023 to .047 away and differ in hue alone, which is the blending Ben saw. Fills may sit on gray (.10 and up).
3. Separate with space first (Article 7.3), then one fill, then a hairline between rows of one list. Never a fill and a line on one edge.
4. A photo carries a 1 px inner edge of `--rule`, because a pale photo on a white page has no edge of its own.
5. Neighbors on the ring never carry two meanings in one view. Aqua sits .042 to .049 from mint and sky, and peach .036 from marigold, so aqua and peach are field colors only.
6. A background that only groups needs no edge. Whatever a person must find before they can act follows the States rule: a word or an icon, never color alone.

#### Which color (agent proposal, round 10; open in the [ledger](ledger.md) as R23)

Ben, [round 9](../product/words.md#2026-11-15-round-9-picks): "the psychology analysis of it all and decision making should be engrained somewhere in the constitution and it should be backed by research". The sources are in [brand-round-10.md](../research/cross-cutting/ben/brand-round-10.md) and [brand-round-11.md](../research/cross-cutting/ben/brand-round-11.md). For anything new on a screen, ask in this order. The first yes decides.
1. A photo or an amount: no color. The photo is the color and the amount is ink (E1).
2. The one thing in this view that needs the person: the field (C2), one per view. Of several like things, the one that differs is the one remembered, and only while it is the only one (the isolation effect).
3. A state of an item: its state fill, with its icon and its word. Marigold, mint and brick follow signs people already know: look, done, stop. Sky for live and lime for paid are ours, so neither appears without its word.
4. A kind of thing: pink, flat.
5. Something the person can do: never a color. Black, then the second button (an outline today; a light fill is open as R33), then gray (C4). Color says what a thing is, and black says what can be done.
6. A failure: brick, always with its word and icon, because red does not mean stop in every culture.
7. Anything else: white or gray.

### Article 6. Type

Ben, 20:17: "im still not set on the fonts. i think you need to justify all text." Since then: mirror QOVES's fonts and how it sets them, without the mono ([round 7](../product/words.md#2026-11-15-round-7-picks)), the wordmark is Clofie SemiBold, with "some bigger things in the app" in Clofie too ([round 8](../product/words.md#2026-11-15-round-8-picks)), and the file is PP Neue Montreal 2.6 ([round 10](../product/words.md#2026-11-15-round-10-picks), L38).

| Face | Sets | Why |
|---|---|---|
| **PP Neue Montreal** 2.6, Book (400) and Medium (500) | Everything people read or tap: item titles, amounts, buttons, tabs, messages, captions, headlines in cards | QOVES sets all of its text in it, headings included, in these two weights ([what its stylesheets say](explore/round-8/qoves-type.md)) |
| **Clofie SemiBold**, 600 | The wordmark, and the short list below | Ben's pick. Geometric and friendly, and not the grotesk every AI app uses |

**Where Clofie goes** (agent decision; Ben asked for it in [round 8](../product/words.md#2026-11-15-round-8-picks); the reasons and sources are in [explore/round-9/clofie-use.md](explore/round-9/clofie-use.md)). A string is set in Clofie only when all five hold: we wrote it, it is 21 px or larger, it fits on one line, it has no digits, and it is the only Clofie string in the view besides the wordmark.

| Clofie | Never Clofie |
|---|---|
| The wordmark | Any amount or number: its digits are 366 to 673 units wide and it has no tabular figures, so an amount that changes would shift |
| The screen title, one per view ("Today", "Sell") | Anything a seller, a buyer or a marketplace wrote: item titles, names, messages. It has 103 glyphs and no accents |
| The headline of a moment: a sale, an empty screen, a first-run screen | Buttons, tabs, labels, captions and headlines in cards |
| Web hero and section headings; post and deck headlines | Any script but Latin; the text face takes the role |

**Banned:** Inter, even as a fallback (Ben's harness rule). Faux bold and faux italics. More than two families in one output, not counting a Noto fallback for a script the text face lacks. Uppercase mono labels as a style (Ben, 19:59: "completely fine not doing a mono font"); use the text face in sentence case.

**Setting rules (these hold whatever faces win):**
1. **Weights.** Text: Book (400), and Medium (500) only for button labels. Display: SemiBold (600), the only Clofie weight. Hierarchy in text comes from size and the two ink levels, never from weight. (QOVES; Ben's brief. This removes the "janky bolding" of round 3, where a medium item title sat next to regular text of nearly the same size.)
2. **Few sizes, far apart.** App: 13, 15, 18, 21, 36 and 50, by role in the table below. 21, 36 and 50 are from Ben's earlier spec at 390 px wide. Adjacent steps differ by at least 15%, so a step reads as intended, not as a mistake (15 to 17 is only 13%, which is why the headline is 18). Web and post sizes scale by the medium table in Part III.
3. **Leading follows QOVES.** Text: 13/18, 15/20, 18/24 (QOVES sets 12/16, 14/20 and 18/24). The screen title at 36 is 1.125 (QOVES's phone hero, 32/36). The amount at 50 is 1.14 (QOVES's big number, 51.66/59.04). Devanagari, Thai and Arabic: at least 1.2 at every size.
4. **Tracking follows QOVES.** 0 up to 18 px; −0.015em at 36; −0.02em at 50 and up. The wordmark is −0.01em. None in Chinese, Japanese or Korean.
5. **Sentence case everywhere.** No title case, no all caps except the platform's own logos.
6. **Second phrase, not bold.** A heading may have a second phrase at black 65%, on white or gray. 21 px and up only.
7. **Numbers that line up or change keep their width.** Set `tabular-nums` on an amount that changes in place or sits in a column, and nowhere else. PP Neue Montreal 2.6 has tabular figures drawn by its designer, 670 units wide in Book and 723 in Medium ([the file note](../research/cross-cutting/ben/neue-montreal-file.md)), so no file is patched.
8. **Sizes follow the person's text setting.** The sizes are the default-size values; on iOS they map to Dynamic Type (13 footnote, 15 subheadline, 18 body, 21 title2, 36 largeTitle) and grow with it. Line heights are ratios, so they grow too.
9. **A size belongs to one face, and to one weight** (Ben, [round 9](../product/words.md#2026-11-15-round-9-picks): "text of the same size should end up being the same font and weight"). 21 and 36 are Clofie. 13, 15, 18 and 50 are the text face. The one exception is 15, where a button label is medium and a row is book, as Apple sets Headline and Body at one size in two weights ([the sources](../research/cross-cutting/ben/brand-round-10.md)). Weight never changes with state: the selected tab keeps its weight (L29; Ben, [round 10](../product/words.md#2026-11-15-round-10-picks)).
10. **Type is centered by its ink** (agent decision A8; Ben, [round 10](../product/words.md#2026-11-15-round-10-picks): "they seem not centered", "tailor them for their quirks"). A label in a control (a button, a tag, a chip, a tab) is centered between its cap height and its baseline, not in its line box. On the web that is `text-box: trim-both cap alphabetic` on the label, and `ex alphabetic` for a string with no capitals (the wordmark). Space above and below a Clofie title is measured from its ink the same way. React Native cannot trim, so each face takes a fixed offset: PP Neue Montreal sits 0.7 to 1.3 px high at every size in the roles table and takes none; Clofie sits .12 em high and moves down by `--nudge-display`. Measured in Chrome on Ben's Mac ([the numbers](../research/cross-cutting/ben/brand-round-11.md)).
11. **Each face has limits, read from its file.** PP Neue Montreal has ’ × − ½ … – and →: write the real character, never x for ×, a hyphen for − or three dots for …. It has no ″ or ′, so a length is written `32 in`. Clofie SemiBold has letters and ’ and none of the other marks: a Clofie string holds no digit, dash, ellipsis or ×. A headline that needs an amount puts the amount on its own line in the text face (C6), so 6.9 holds.
12. **Off the app** (agent proposal, R26; a maker working from this file alone had to guess). Sizes for a deck, a post or the web come from `brand/media.css`. Every size of 32 and up is set at leading 1.1 and tracking `-0.02em`; text under 32 at leading 1.4 and tracking 0.

**Roles** (agent proposal; tokens in [tokens.css](tokens.css)):

| Role | Size | Face and weight | Ink |
|---|---|---|---|
| Caption, time, tab label | 13 | text 400 | ink-2 |
| Body, list row, price in a row, card title | 15 | text 400 | ink |
| Button label | 15 | text 500 | white on the pill, ink on the others |
| Headline in a card or sheet; text you type | 18 | text 400 | ink |
| Wordmark | 21 | Clofie 600 | ink |
| Screen title, one per view | 36 | Clofie 600 | ink |
| The peak amount on a sale | 50 | text 400 | ink |

**Any language.** The same rules hold in every language: sentence case, two weights, the size steps, no exclamation marks, no em dashes. When a script is not covered by the text face, fall back to Noto Sans in that script at the matching weight (the stack is in `tokens.css`), and check that line breaks still fall between words or phrases, not inside them. Numbers, dates and currency follow the locale (`Intl.NumberFormat`), never a hard-coded US format. Length limits counted in words count 2 characters as a word in Chinese, Japanese and Korean. The display face is never used for a script it does not cover; the text face takes the role instead.

### Article 7. Space and layout

1. **One scale.** 4, 8, 12, 16, 20, 24, 32, 48, 64. No other gaps.
2. **Inside is tighter than between.** Parts of one thing sit 4 to 12 apart; separate things 12 to 16; sections 24 to 48. If two gaps are equal, the eye cannot tell what belongs together.
3. **Group with space, not boxes.** No box inside a box. A card holds one thing; a section holds cards; nothing else frames anything.
4. **One focal point per view** (E1), then the next action.
5. **Alignment is on one start edge** per column (left in left-to-right scripts, right in right-to-left; use logical properties). Centered text only for the wordmark (C1), single-line headings on posts and end cards.
6. **True scale.** App mockups are 390 × 844 pt and are judged at that size on Ben's MacBook (1512 × 982 pt, Retina). Generated UI at 1.5× scale is the most common image-model failure; attach a true-scale render as the anchor.
7. **A pill is balanced at its icon** (agent decision A9; Ben, [round 10](../product/words.md#2026-11-15-round-10-picks): "the padding for the live little sticker over the patagonia vest feels a little off"). At an icon end the padding is one step less than at a text end: `--s-3` and `--s-4` in a button, `--s-1` and `--s-2` in a tag. A tag is 24 tall with a 16 icon, so the icon is 4 from the top, the bottom and the near end.
8. **One kind, one size** (L37). An item in a feed is 96 tall: a 72 photo with 12 above and below. A thing that needs the person is 152: the same row, 12, then a 44 row of actions. A tile in the grid is a square photo the width of its column, 8, a 20 line, 4, a 20 line.
9. **The foot of a page** (agent proposal, R31; Ben, [round 10](../product/words.md#2026-11-15-round-10-picks): "you need consider footers too. and spacing. and all the sub options that might need to be at the bottom of pages"). A page that scrolls ends with 32 and then the 34 of the home indicator. A bar pinned to the foot holds the page's one act and nothing else, in buttons of `--button-h`, 16 above the safe area, and a page has one only when its act is not in its first 844. What a person can do to the page's subject that is not today's decision sits in plain ruled rows at the end of the page, with the one that cannot be undone last.
10. **One number first** (agent proposal, R31; Ben, [round 10](../product/words.md#2026-11-15-round-10-picks): "minimizing the amount of info and allowing the user to see more info if needed truly"). Where a sum stands behind an amount, the page shows the amount and one line that opens the sum. The sum is never open on arrival, except on a sale.

### Article 8. Imagery

1. **Photos of real things**, shot like a careful person with a phone: daylight, plain ground (wood floor, white sheet, concrete, a wall), the object large and slightly off center, honest wear visible.
2. **No people in item photos**, no hands unless the hand gives scale, no lifestyle scenes, no stock models.
3. **No illustration** of products, no mascots, no 3D blobs, no abstract AI art.
4. **Generated images** are allowed for mockups and demos only, stored in `assets/demo-items/`, and never presented as a real listing or a real user's item.
5. **Relit studio photos** (the product's own feature) are always shown next to the real photo, never instead of it (vision, Open).

### Article 9. Shape, depth and texture

1. **Radius scale:** 8 (photos inside cards), 14 (cards), 20 (sheets), pill (buttons, chips).
2. **Depth:** one of two, chosen per medium and kept: hairline rules (1 px black at 8%) or one soft shadow (`0 1px 2px` plus a wide faint blur). Never both on one surface, no colored glow on white except the one under the black pill (C4), never glass. The app uses hairlines. Whether the receipt (L41) may be the one thing with the shadow is open as R31.
3. **No texture.** No grain and no lines, on the field or anywhere else (Ben, rounds 6 and 7).

### Article 10. Icons and logos

1. Hugeicons Stroke Rounded, 1.5 px stroke at 24 px, black or black 65%. One icon set per output. No Lucide or lookalikes (Ben's harness rule). The eight state icons stay Hugeicons (Ben, [round 10](../product/words.md#2026-11-15-round-10-picks): "for icons leave them they are fine"). Below 20 px the stroke is drawn at 1.9, so it stays near 1.25 px.
2. An icon never stands alone where a word is clearer, except the five tab icons and universally known glyphs (share, more, close).
3. No icon-topped cards (a big icon above a title above a paragraph): the most common AI layout.
4. Platform logos follow C5. A logo file is a square the mark fills: the mark spans at least 80% of the square one way. Measured 2026-11-15: Depop 100%, eBay 85% wide and 37% tall on an off-white ground, Facebook 82%, Mercari 64%, Poshmark 60%. So eBay, Mercari and Poshmark read under size beside the others and need new files.

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
5. **No exclamation marks, no em dashes and no emoji**, in any language. Ben: "ban all emojis" ([words](../product/words.md#2026-11-15-standard-sizes-darker-dark-colors-deslop-skills-and-ban-all-emojis)).
6. **Never invent** a number, a customer, a quote or a result. A slot without a source stays visibly empty.

### Article 13. Not AI-made

Each AI tell is paired with what to reach for, because banning one default moves the output to the next likeliest one (ui-factory). A single hit is a question; a cluster is a failure.

| Tell | Reach for |
|---|---|
| Purple or blue-to-purple gradients, sparkles, glowing orbs | The soft field (C2), held to one card |
| A flat two-stop CSS gradient | The sampled mesh: several soft points of color |
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
5. **Run the checks.** Write anything that is not the app as HTML that reads `tokens.css`, one `data-view` per slide, panel or frame, then run `node scripts/brand-check.mjs <file> --medium <app, web, post, story or deck>`. Hand the render and `node scripts/ui-rules.mjs judge <medium>` to a fresh agent, and write the reason ledger (Article 1).
6. **Show it at true size** in its real context: a phone screen at 390 pt, a post in an Instagram grid, a video on a phone.

---

## Part III. Media

| | App | Website | Instagram post / carousel | Story / Reel / video | Pitch deck |
|---|---|---|---|---|---|
| Canvas | 390 × 844 pt | 1440 wide desktop, 390 mobile | 1080 × 1350 | 1080 × 1920 | 1920 × 1080 |
| A view is | One screen at one scroll position, or one sheet | One viewport at one scroll position | One slide | One frame | One slide |
| Margins | 20 | 24 mobile, 64 desktop, 1200 max content | 72 | 96 sides; keep 250 top and 340 bottom clear of UI | 96 |
| Wordmark (C1) | Nav bar, centered, 21 px | Header left, 21 px; footer 86.5 px at 1440 and 50 px at 390, the hero's sizes | Top or bottom center, 40 px, same place in a series | End card, centered, 120 px | Title slide and last slide only, 64 px |
| Field (C2) | The one card or band that needs you | The hero band | Background of one panel per carousel, or one band | One scene or the end card | Title slide and one key slide |
| Item (C3) | Every item row and card | Real items in every example | The item is the post | Real item footage | Real screenshots and photos |
| Act (C4) | One per decision | One per section | None (posts don't have buttons); a plain line instead | None | None |
| Text sizes | 13 / 15 / 18 / 21 / 36 / 50 | Display, Ben's sizes from 390 to 1440 wide: hero 50 to 86.5, section 36 to 58.3, feature 21 to 24.9 (`clamp()` between). Text 15 and 18 at every width | Body 40, heading 72, one number up to 200 | Captions 48, titles 96 | Body 32, heading 64, one number up to 200 |
| Unit: the space and radius scales are multiplied by it (agent decision) | 1 | 1 | 3 | 3 | 2 |
| Longest text | One sentence per card | Two short paragraphs per section | 20 words per slide | 8 words on screen at once | 15 words per slide |

The numbers in this table are also in [media.json](media.json), which the checker reads. A test fails when the two differ, so change both in one commit. A post, a story and a deck take their sizes, margins and scaled gaps as variables from [media.css](media.css), which a script writes from media.json, so nothing off the app sets a raw number: `var(--mt-heading)`, `var(--ms-4)`, `var(--mr-card)`. How many views the field may fill is in Article 5.2 and the Field row. An app screen shown on a slide, a post or a page is a picture of the screen that passed its own check, placed as an image, never the screen's markup set again at another size.

Post and video notes:
- A carousel tells one story per slide in order: the item, what it is worth, where it sold, what you kept.
- Video uses the app's own screens at true scale inside the frame, never a fake device mockup with hands.
- Captions are the voice in Article 12. Hashtags only if they are real search terms, at the end, at most 3.

---

## Part IV. Checks

Each rule has an id, a check, and who runs it. **Script** means [scripts/brand-check.mjs](../scripts/brand-check.mjs) holds it on the rendered output, in any medium written as HTML: it measures the page in a browser and [render.mjs](../.agents/checks/render.mjs) fails what breaks the rule. It runs when someone makes an output, and its tests run on every push. **Look** means one "Fail if" line handed to a fresh agent with the render and nothing else. Brand feel always goes to Ben. **Not built** means a script could hold it and none does yet. Each row's holder is in [ui-rules.json](../.agents/ui-rules.json), and the repo check fails when that list and this table disagree. An image or a video frame with no HTML source gets the Looks only.

| Id | Rule | Check | Runs |
|---|---|---|---|
| B1 | Every element has a reason (Art. 1) | Reason ledger has zero blanks and no reason from the list in Art. 1.2 | Look |
| B2 | Squint test (E1) | Blur the render 8 px; the first visible mass is an item photo or an amount (except outputs whose job is brand recognition) | Look |
| B3 | Wordmark lowercase, placed by medium (C1) | Text content equals "secondhand"; app: centered in nav bar ±1 px | Script |
| B4 | One field per view (C2) | Count elements using the field token; must be ≤ 1 | Script |
| B5 | Field is a soft mesh (C2) | The field element has at least three color points and no line or noise layer | Script |
| B6 | Text contrast (Art. 5.1) | Every text node ≥ 4.5:1 with what is behind it (≥ 3:1 at 24 px and up). On field, state and category fills, text is ink only. White text only on the black pill and brick | Script |
| B7 | No colored text, lines or icons on white (Art. 5.1) | Computed `color`, `border-color`, SVG `stroke` on white grounds are black or black 65%, except logos, brick and the unread dot | Script |
| B8 | Color ≤ one third of the view (Art. 5.2) | Pixel share that is non-neutral and non-photo ≤ 33%; translucent black counts as black. A view the field fills is exempt, and Part III caps how many an output has | Script |
| B9 | Every item has a photo (C3) | Every element marked `data-item` holds a photo. Every photo and logo has `alt` text; an icon of 32 px or less may have `alt=""` | Script |
| B10 | One black pill per decision (C4) | At most one black pill in a box and in a card (a `data-part`); none in a medium that has no buttons | Script |
| B11 | Logos not names (C5) | No marketplace name as visible text where a logo slot exists; logo `aria-label` present | Not built |
| B12 | Money says what it is, with no highlight (C6) | Each amount has words in its row or block that say what it is, and no band of color behind it | Script |
| B13 | Weights (Art. 6.1) | Computed `font-weight` values ⊆ {400, 500, 600}; 600 only in the display face; 500 only inside a button or a link styled as one | Script |
| B14 | Size steps only (Art. 6.2) | At the default text size, computed sizes ⊆ the medium's set. Web: at 390 and 1440 wide each display size equals its endpoint, and text sizes ⊆ {15, 18}. The wordmark is exempt (its size is in Part III) | Script |
| B15 | No banned faces (Art. 6) | Computed `font-family` contains no Inter; loaded fonts match the picks | Script |
| B16 | Sentence case (Art. 6.5) | No phrase is all caps. One word in capitals and title case are warnings, because a name may be written that way | Script |
| B17 | Spacing scale (Art. 7.1) | Every gap inside a component ∈ {0, 4, 8, 12, 16, 20, 24, 32, 48, 64}; canvas margins and safe areas come from Part III. Text stays inside the margins; a photo stays inside them or runs to the edge; web text is no wider than the content width | Script |
| B18 | Inside tighter than between (Art. 7.2) | For each card, max internal gap < gap to its sibling | Not built |
| B19 | No box in a box (Art. 7.3) | No bordered or filled element inside another bordered or filled element, except photos, buttons and state pills | Not built |
| B20 | Radius scale (Art. 9.1) | Border radii ⊆ {0, 8, 14, 20, 999} | Script |
| B21 | One depth system (Art. 9.2) | Not both borders and shadows on cards in one view | Script |
| B22 | One icon set (Art. 10) | All icons from Hugeicons Stroke Rounded | Not built |
| B23 | Words (Art. 12; copy.md) | `node scripts/copy-lint.mjs` clean or each hit justified; no `!`, `—` or emoji | Script |
| B24 | Numbers a person can say back (E3) | Read each number aloud with its label to someone new; they can explain it | Look |
| B25 | Default test (Art. 13) | Side by side with the no-brand default; fewer than 3 matching axes (an axis matches when a fresh agent would call the two the same choice) | Look |
| B26 | Video text holds (Art. 11.3) | Each on-screen text duration ≥ 0.3 s per word (2 characters in CJK) + 1 s | Not built |
| B27 | Locale (Art. 6) | Money and dates rendered through the locale formatter; no hard-coded "$" in strings | Not built |
| B28 | True scale (Art. 7.6) | App renders are 390 × 844 pt; images judged at 390 CSS px wide | Script |
| B29 | Feel | Ben looks at it | Ben |
| B30 | Longest text (Part III) | Words in a view ≤ the medium's limit, not counting the wordmark | Script |
| B31 | Things of one kind are one size, whatever is in them (Ben, [words](../product/words.md#2026-11-15-standard-sizes-darker-dark-colors-deslop-skills-and-ban-all-emojis)) | Every element with the same `data-part` name renders at one height and one width on every view of the output, within 1 px. `data-fit="content"` lets a width follow its words | Script |
| B32 | The wordmark's kit (C1; agent proposal, ledger R26) | Once per view; no transform, shadow, outline, stroke, filter, fade or motion; no fill or box of its own; ink or white, on the page or the field; nothing else within half its type size | Script |
| B33 | Logos in a row (C5; agent proposal, ledger R26) | Logos that share a parent render at one height and one gap, and none is taller than the wordmark's type. A logo standing alone is not a row | Script |
| B34 | A thing holds whatever is in it (Ben, [standard sizes](../product/words.md#2026-11-15-standard-sizes-darker-dark-colors-deslop-skills-and-ban-all-emojis), [edge states](../product/words.md#2026-11-15-a-standard-for-edge-states-known-and-learned-while-building)) | The checker puts each piece of extreme content in [ui-states.json](../.agents/ui-states.json) into every slot marked `data-fill` and measures again: each `data-part` keeps its size, text a box cuts off ends in an ellipsis, and nothing spills out, runs over its neighbor or crosses a margin | Script |
| B35 | Every state is drawn (Ben, [edge states](../product/words.md#2026-11-15-a-standard-for-edge-states-known-and-learned-while-building)) | A view or part that names itself (`data-screen`, `data-job`, `data-control`) with a `data-state` is drawn in every required state of its kind in ui-states.json, or `data-skip="state: why it can't happen"`. A state not on the list fails until it is added | Script |

**Marks the checker reads.** `data-view` on each slide, panel or frame (with none, each screenful is a view). `data-part="name"` on each kind of repeated thing: a card, a chip, a tile. `data-fit="content"` on a part whose width follows its words. `data-item` on anything that shows an item. `data-photo` on a photo that is not an `img`, and `data-logo` on a logo. `data-chrome` on the phone's own status bar and home bar in an app mock, which are skipped. `data-fill="title"` (or `name`, `amount`, `count`, `text`, `photo`) on a slot whose content changes from one item or person to the next.

**How the list of edge states grows.** When content or a state nobody drew breaks a screen, add it before fixing the screen: `node scripts/ui-states.mjs content title "<the text>" "<where it came up>"` or `node scripts/ui-states.mjs state screen <name> "<where>"`. From then on every output is checked with it. The repo check asks any commit that fixes a screen and adds nothing what the system learned.

A check that passes is not proof of taste ("scripts can't prove it looks good"). It is proof the rules were followed. Record results with the output.

---

## Part V. Changing this file

1. Ends (Part I) and codes (Article 4) change only on Ben's word. Log his exact words in [product/words.md](../product/words.md) and the decision in [product/decisions.md](../product/decisions.md).
2. A correction from Ben is recorded word for word, generalized to the class of thing it is about, and offered as a check in Part IV. It becomes a standing rule only when he says yes. Not every problem becomes a rule.
3. Values change in `tokens.css` and in the tables here in the same commit.
4. A rule that turns out to fight an end is fixed here, never overridden in a component.
