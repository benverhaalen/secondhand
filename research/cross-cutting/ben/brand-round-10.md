# What do Ben's round 9 questions rest on?
Researched 2026-11-15 by Ben (Claude Code agent, brand thread). Feature: cross-cutting (brand).

Ben asked five things in his [round 9 notes](../../../product/words.md#2026-11-15-round-9-picks). This note holds what each answer rests on. The answers themselves are proposals in [brand/constitution.md](../../../brand/constitution.md) and open rows in [brand/ledger.md](../../../brand/ledger.md). Every page was read through a fetch helper on 2026-11-15, which returns a paraphrase, so a quote here is short and a paraphrase is marked as one. Marks: *observed* (read on the page or measured), *asserted* (a source says so and we did not check it), *inferred* (our reasoning).

## 1. Should text of one size share one font and weight?

Ben: "text of the same size should end up being the same font and weight and share characteristics. use research to see if this is true or investigate the nuance".

| Source | What it says | Mark |
|---|---|---|
| [Apple HIG, Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | iOS has eleven text styles at the default size: Large Title 34, Title 1 28, Title 2 22, Title 3 20, Headline 17, Body 17, Callout 16, Subhead 15, Footnote 13, Caption 1 12, Caption 2 11. Ten sizes. Only Headline and Body share one, and they differ in weight: Semibold and Regular | observed |
| Same page | "Minimize the number of typefaces you use, even in a highly customized interface." | observed |
| [Rauno Freiberg, Web Interface Guidelines](https://interfaces.rauno.me/) | Do not change font weight on hover or for a selected state, because the layout shifts. No weight under 400. Tabular figures in tables and timers | observed |
| Material Design 3 type scale | The pages did not render for the fetch helper | not read |

What follows (*inferred*):
- Ben's instinct holds. In the most worked-out type system we could read, a size nearly always means one face and one weight.
- The one exception has a reason: two roles that do different jobs. A line you read and a label that heads it. Our matching case is 15 px: a row is regular and a button label is medium.
- Weight should not move with state. That argues against the medium label on the selected tab, which Ben locked in round 7 (L29). It is put to him as R21.
- Clofie gets more room only by owning a size outright. It owns 21 and 36.

## 2. When do two things blend, and what separates them?

Ben: "look at pink or lilac they kind of blend into whatever background type thing you had there. ensuring something in the system acts as a separator".

Measured from [brand/tokens.css](../../../brand/tokens.css) as the distance between two colors in Oklab (*observed*; the script is not in the repo yet):

| Pair | Distance | Lightness contrast |
|---|---|---|
| Gray on white | .043 | 1.13:1 |
| A hairline (black at 8%) on white | .060 | |
| A fill on white | .137 to .147 | 1.21 to 1.48 |
| A fill on gray | .102 to .124 | 1.07 to 1.30 |
| A tint on white | .050 to .064 | 1.12 to 1.15 |
| A tint on gray: lilac, sky, pink, peach, brick | .023 to .027 | 1.00 to 1.02 |
| A tint on gray: aqua, mint, marigold, lime | .043 to .047 | 1.00 to 1.01 |
| A fill on its own tint | .079 to .089 | |
| Neighbors on the ring: marigold and peach, aqua and mint, sky and aqua | .036, .042, .049 | |
| Other neighbors on the ring | .060 to .112 | |

| Source | What it says | Mark |
|---|---|---|
| [WCAG 2.1, 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html) | 3:1 for the parts needed to identify a control or a required graphic. A control identified by its text needs no visible boundary | observed |
| [WCAG 2.1, 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html) | Color is never the only way to carry information | observed |
| [Jakub Krehel](https://jakub.kr/) | A nested corner is the inner corner plus the padding. A 1 px outline at 10% black, set inside an image, keeps a pale image from merging with the page | observed |
| [Vercel, Web Interface Guidelines](https://vercel.com/design/guidelines) | Nested radii share a center. Layered shadows. 44 px touch targets on mobile | observed |
| CSS Color 4, on the smallest difference the eye sees in Oklab | The section did not load | not read |

What follows (*inferred*):
- Ben saw what the numbers show. Pink and lilac tints on gray are .025 and .023 apart from it and differ in hue only.
- We have no source for a threshold, so the threshold comes from Ben's own eye: he reads gray on white (.043) as separate and a tint on gray (.023) as merged. The proposal is .04.
- A grouping background needs no 3:1 edge under WCAG. Something a person must find to act on needs a word, an icon or that edge.
- Three pairs of neighbors on the ring are too close to carry two meanings. Aqua and peach each sit between two colors that already mean something, so they should not mark kinds of things.

## 3. What decides which color goes where?

Ben: "the psychology analysis of it all and decision making should be engrained somewhere in the constitution and it should be backed by research".

| Source | What it says | Mark |
|---|---|---|
| [Von Restorff effect](https://en.wikipedia.org/wiki/Von_Restorff_effect) (Wikipedia) | Of several like things, the one that differs is remembered best. Hedwig von Restorff, 1933 | asserted |
| [Apple HIG, Color](https://developer.apple.com/design/human-interface-guidelines/color) | "Avoid using the same color to mean different things." Do not rely on color alone to tell things apart. What red means differs by culture | observed |
| [ISO 3864](https://en.wikipedia.org/wiki/ISO_3864) (Wikipedia) | Safety signs: red for prohibition, yellow for warning, blue for a required action, green for a safe condition | asserted |
| [Color blindness](https://en.wikipedia.org/wiki/Color_blindness) (Wikipedia) | Red and green confusion affects up to 1 in 12 men and 1 in 200 women | asserted |
| Labrecque and Milne, 2012, "Exciting red and competent blue" | Hue maps to brand personality, and saturation and lightness change how strongly. Abstract only | asserted |
| Valdez and Mehrabian, 1994, "Effects of color on emotions" | Often cited for: lighter colors are more pleasant, and more saturated colors are more arousing. PubMed and APA refused the fetch | not read |
| Elliot and Maier, 2014, "Color psychology" | Annual Reviews refused the fetch | not read |

What follows (*inferred*):
- One loud color event per view is the isolation effect put to work. It stops working when a second thing is as loud.
- Each state color follows a sign people already know, except lime for money, which is ours. So lime always carries its word.
- Every state carries an icon and a word because color fails for about 8% of men, and because red does not mean the same thing everywhere.
- "Light, soft colors feel calm" is not written into the constitution as a fact. The two papers behind it were not read.

## 4. The small things senior designers do

Ben: "think of all the little things that only expert senior or super senior ui ux design or software psychology people think of".

The repo already holds Emil Kowalski, Vercel's guidelines, Apple's motion pages, NN/g and the Laws of UX in [frontend-references.md](frontend-references.md), with motion in [motion-and-speed.md](motion-and-speed.md). New this round, all *observed* through the fetch helper:

| Detail | Source | In the round 10 mocks |
|---|---|---|
| Nested corners: outer equals inner plus padding | Jakub Krehel, Vercel | Yes: 8 + 12 = 20 |
| A 1 px inner edge on images | Jakub Krehel | Yes, at 8% black |
| Tabular figures where numbers update or line up, not elsewhere | Rauno Freiberg, Jakub Krehel, Vercel | Yes |
| A press scales to about .96 | Rauno Freiberg | .97, from the frontend standard |
| Interaction animations of 200 ms or less | Rauno Freiberg | 150 ms on a press |
| No weight change on hover or selection | Rauno Freiberg | Put to Ben as R21 |
| Focus rings drawn with a shadow, so they follow the corner | Rauno Freiberg | Yes |
| 44 px touch targets | Vercel | Yes |
| Curly quotes and the ellipsis character | Vercel | Curly apostrophe, a true × and a true minus |
| Optical alignment by a pixel where a shape looks off center | Jakub Krehel, Vercel | Not yet |
| Balanced line breaks in headlines | Jakub Krehel | Not yet |
| Layered shadows in place of borders | Jakub Krehel, Vercel | Not used: our depth is a fill or a hairline |

## 5. How studios present a brand, and what ours is missing

Ben: "i know hex inc is one company ... see if there are any other big players for san fran startups ... use some case studies about how a brand is presented and the features of it and identify the gaps in our brand."

| Case study | The idea in one line | Features the page names | Mark |
|---|---|---|---|
| [Hex, Exa](https://hex.inc/work/exa) | A search engine for AI with an old mission: order all knowledge | Greek line drawings joined by node lines, off-white and link blue, a serif display face with a sans, an illustration kit, a sub-brand | observed |
| [Hex, Attio](https://hex.inc/work/attio) | One brand in two registers: warm for sales teams, dark for developers | Warm gradients over dotted grids, a colored line language, ASCII and isometric drawings | observed |
| [Koto, Lyft](https://koto.com/projects/lyft) | Lyft grows up and stays playful | A refined logo, bold type, pink, photos of people. Sections: challenge, strategy, identity, application, outcome | observed |
| [Further, Airbnb](https://www.further.group/work/airbnb) | "Belong Anywhere" | The Belo symbol, simple enough for anyone to draw. Photos of real people and places. A warm voice | observed |
| [Collins, Figma](https://www.wearecollins.com/work/figma/) | "Nothing Great Is Made Alone" | The page names ideas, not assets: interface parts used as brand marks, and one memorable cue | observed |
| [Linear, brand page](https://linear.app/brand) | None stated | Wordmark, logomark, icon, naming, rules of use, three colors. No type, motion or voice | observed |

Hex lists about 58 clients, among them Replit, Grafana, Exa, Square, Cal.com, Framer, Attio, OpenSea and Whop (*observed* on [hex.inc/clients](https://www.hex.inc/clients)). Its case studies are a brand and a marketing site. Koto lists Lyft, Coinbase, Microsoft, Adobe, WhatsApp, Bolt and Nubank among its work (*observed* on koto.com/work). A list article also names Clay, Instrument, Work & Co and Huge as studios for technology companies (*asserted*, ParallelHQ; not checked).

Present in at least three of the six pages (*observed*): a central logo or mark, a set palette, one named graphic device, and the system shown on many surfaces. Five of the six open with the idea in one line.

Against that, for secondhand (*inferred*):

| | Have | Missing |
|---|---|---|
| The idea in one line | Ben's two meanings of the name, in constitution E2 | A line a stranger would read |
| A mark | The wordmark in Clofie SemiBold | A symbol, and so an app icon |
| A palette | Eight hues on a ring, three steps each, with a rule | |
| A named device | The field, with rules for what is allowed and how it moves | |
| Motion and sound | The field drifts, and a sale fills the screen | The sale's sound and haptic are not chosen |
| Icons | Hugeicons, a stock set | Our own drawing of the eight state icons, which are seen most |
| Photography | Rules in Article 8 | Every mock uses generated photos. Three real ones sit in `assets/demo-items/real/` |
| Shown on many surfaces | The app | Posts, site and decks, which the thread "Build the brand system for everything" is doing |
