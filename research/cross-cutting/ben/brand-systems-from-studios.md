# How do design studios and in-house brand teams define a complete brand system, and what does ours lack?
Researched 2026-11-15 by Ben (Claude Code research agent, Fable 5.2). Feature: cross-cutting.

Feeds [brand/constitution.md](../../../brand/constitution.md): what the base brand needs before decks, posts, the site and print are built from it.

**Marks.** The web was open. A claim tied to a source key is *observed*: opened 2026-11-15 through a fetch tool that returns a small model's reading, so quotes are as returned, not checked against page source. Gap verdicts and check methods are *inferred*. Memory is marked *asserted*.

**Draft from memory, and what changed.** Draft: guidelines hold strategy, logo, color, type, grid, imagery, motion, voice, applications and governance; ours lacks logo construction, templates and print. It mostly held. Changes: no source gives a numeric color ratio, none publishes slide templates, and ours is ahead of every source on testable ends, checks and change rules.

## Sources

| Key | Source | Year | Job | What I opened |
|---|---|---|---|---|
| N | [NASA Graphics Standards Manual](https://www.nasa.gov/wp-content/uploads/2015/01/nasa_graphics_manual_nhb_1430-2_jan_1976.pdf), Danne & Blackburn (*asserted*: the text names no designer) | 1976, a later printing | Anatomy of a full manual; misuse list | Whole PDF text |
| G | [GOV.UK brand guidelines](https://brand.design-system.service.gov.uk/introduction) | 2025 (listing date; pages carry none) | Brand split by channel; unit construction | Sitemap and 10 pages |
| U | Uber [partner PDF](https://cdn.shopify.com/s/files/1/0565/3423/7349/files/Uber_2018.pdf) and [guide](https://brand.uber.com/guide). Wolff Olins credit is *asserted* | 2018, 2019 | Rules with numbers in every element | Both |
| I | [IBM Design Language](https://www.ibm.com/design/language/) | Updated 2026-11-05 | Grid across media; data | Nav, 2x grid, color, data overview |
| S | [Spotify design and branding](https://developer.spotify.com/documentation/design) | Footer 2026 | Rules for apps that show another brand's marks | Whole page |
| A | Audi CI: [rings](https://audi.com/ci/en/intro/basics/rings.html), [YouTube](https://audi.com/ci/en/guides/communication-media/social-media/youtube.html) | Undated | Mark rules; video end cards | 3 pages |
| B | [Starbucks creative expression](https://creative.starbucks.com/) | 2020 | Functional and expressive roles | Home, color, logos, typography |
| F | Firefox [platform](https://mozilla.design/firefox/), [logos](https://mozilla.design/firefox/logos-usage) | Undated | Positioning written down | 2 pages |
| M | Mailchimp [content style guide](https://styleguide.mailchimp.com/voice-and-tone/), [brand assets](https://mailchimp.com/about/brand-assets/) | 2023, 2026 | Voice | 2 pages |
| T | [Atlassian foundations, logos](https://atlassian.design/foundations/logos) | 2026 | Paired do and don't | 1 page |
| V, L | [Vercel brands](https://vercel.com/geist/brands), [Linear brand](https://linear.app/brand) | Undated | What a small product company publishes | 1 page each |
| D | [Dropbox brand](https://brand.dropbox.com/) | Undated | Section list only | Home |
| | Studio and vendor writing: [Instrument](https://www.instrument.com/latest/modern-brands-should-feel-alive), [Frontify](https://frontify.com/en/guide/brand-guidelines) (2026) | | Weak signal on structure | 1 page each |

Counts are out of these 13 brand sources and are floors: I did not open every page of each.

## 1. The anatomy of a brand system

| Section | Count | Who |
|---|---|---|
| Logo versions and when to use each | 13 | all |
| Logo misuse list | 10 | N S F U A M V L G T |
| Logo color by background | 10 | N S F U A M V L G T |
| Color palette with roles | 10 | N S I B U M L G T D |
| Co-branding, partner or third-party marks | 9 | N S U A M V L G T |
| Typography | 8 | N S I B U D G T |
| Asset downloads or reproduction art | 8 | N S U M V L G T |
| Clear space set by a unit of the mark | 7 | S F U A V G T (M and L say only "room to breathe") |
| Governance: who approves an exception, legal terms | 7 | N S U M V L G |
| Brand core: purpose, positioning, principles | 6 | F A B I D U |
| Small marks: app icon, favicon, avatar | 6 | G A S I L T |
| Motion | 6 | I U D G A T |
| Minimum size in numbers | 5 | S U A G T |
| How to write the name in text | 5 | M L V U S |
| Color dominance, in words | 5 | U I B G N |
| Grid or composition | 4 | N I U T |
| Voice and tone | 4 | U D M T |
| Photography | 4 | I U D A |
| Illustration; iconography | 4 each | I U G T; I U D T |
| Accessibility as its own section | 4 | G I T M |
| Applications by channel (social, video, print, signs) | 4 | N G A I |
| Expression range (reserved to bold) | 3 | G B U |
| Video end frames | 2 | G A |
| Data visualization | 2 | I G |
| Color ratio as a number | 0 | |
| Slide templates | 0 | Frontify lists "Templates and applications" as a core section |

**How rules are phrased.** N: "must not", "should never". S: paired pictures captioned YES and NO. T: paired "Do" and "Don't". G: "Do not" lines under "Incorrect usage". M: "Please do", "Please don't". Each line names one visible property, which is why most can be checked without taste (*inferred*).

## 2. Gap table

| Section | Ours | Verdict |
|---|---|---|
| Positioning and personality as testable statements | E1 to E6, each with a test | **Partly. Suspicion mostly rejected.** No source tests its positioning; ours does. Missing: who it is for, one promise line (F: "Firefox fights for you"), and trait pairs (M) |
| Wordmark construction | C1: face, case, placement, two minimums, five nevers | **Missing.** No clear space, no print minimum, no drawn file, no misuse list with checks, nothing for a busy ground |
| App icon, favicon, avatar, splash | None | **Missing.** [app/app.json](../../../app/app.json) still has the template's blue `#208AEF` splash, off palette. A ten-letter wordmark cannot be a 16 px favicon, and no short mark exists |
| Name in running text | C1 "never in a sentence" covers the mark only | **Missing.** Sentence start, possessive, "second hand" |
| Color proportion per medium | Art. 5.2, B8: at most a third | **Covered. Suspicion rejected.** Stricter than any source. Gap: no floor, one number for all media |
| Print color | None | **Missing.** No CMYK or spot values. Line 3 names a sticker |
| The field off screen | C2: code only, never static | **Conflict.** Part III puts the field on posts, decks and a sticker, which are still images |
| Grid for decks and posts | Part III: canvas, margins | **Missing.** No columns, zones, or margin derived from a unit (U, I) |
| Slide templates | Deck column: sizes, 15 words | **Missing.** Confirmed by need, not by public guidelines |
| Data visualization | C6, one amount | **Missing.** No chart rules for a deck |
| Photography | Art. 8, C3 | **Partly. Suspicion mostly rejected for items.** Missing: item share of frame, crop ratios, what to do with a bad seller photo, screenshot framing |
| Motion off the app | Art. 11, B26 | **Partly.** No wordmark motion, end card layout by aspect ratio, or signed-out site motion |
| Marketplace logos | C5, L17 | **Partly.** No size, clear space, order or equal-size rule, no "no endorsement" line. Three of five files are redrawn stand-ins ([assets/platforms/README.md](../../../assets/platforms/README.md)), which C5 forbids |
| Voice | Art. 12, copy.md | **Covered** as rules; no traits |
| Accessibility | B6, state icons, focus, Dynamic Type; frontend-standard | **Partly.** Nothing for posts and video: alt text, captions, legible size at distance |
| Expression range | E2: one calm register | **Missing.** No rule for when a surface may be bolder |
| Sound | L26 names a sale sound | **Missing** |
| File naming and asset governance | Fonts and logos only | **Missing.** No list of masters, export sizes or names |
| How the system changes | Part V, ledger, words.md | **Covered. Suspicion rejected.** Stronger than every source |

## 3. Do and don't

| Rule, as one testable line | Seen in | Check |
|---|---|---|
| The mark is never stretched, rotated, skewed, flipped or redrawn | N S U A G T V L M | Script: one wordmark component, no transform; rendered box ratio equals the master's within 1% |
| Nothing enters the clear space, one unit taken from the mark | S F U A V G T | Script, DOM: no other box inside the mark's box grown by the unit |
| The mark is never under its minimum size | S U A G T | Script: rendered height against the medium's floor |
| The mark is one of two colors, on a ground that is plain and contrasting | N S F U A G T | Script, render: mark color in {ink, white}; contrast and pixel variance under its box |
| No shadow, outline, fill effect or container on the mark | N S G T | Script, source: no shadow, filter, stroke, border or background on it |
| The mark is not used in a sentence or as a letter | S | Script: the component is never inside a text run |
| No color outside the palette | S G I U | Script: every color in source is a token; on a render, non-photo pixel clusters sit near a token |
| Text is black or white, never colored | U | Script (B7) |
| The accent is kept for its one meaning and never covers a surface | U N | Script: state to token map; B8 |
| Color is never the only sign | I G | Script: every state pill has an icon child |
| No all caps; tracking is not adjusted | U G | Script (B16); letter-spacing in the token set |
| A headline is at most N lines; centered text only when short | G (5 lines) A (3) | Script, render: line count; `text-align: center` only on one-line nodes |
| One signature device per composition, kept for key moments | U G | Script: count the field (B4). Judge: "Is the field behind the most important thing?" |
| Margin, mark and headline sizes come from one unit | U I | Script: each equals unit times a listed multiple |
| Nothing covers the product or another party's artwork | S A | Script: no box overlaps an item photo. Ours allows a state tag and a logo bubble, so list the exceptions |
| Another brand's mark is unaltered and not locked up with ours | S U M L V T A | Script: file hash equals the owner's file; gap between marks. Human: read each owner's rules once |
| Video ends on a fixed frame per aspect ratio | G A | Script: last frames against the end card render |
| A chart has a title that states the trend, a subtitle with measure, place and time, and a source | G | Script on the chart spec: fields present; annotation at most 50 characters |
| The product fills a stated share of the photo; light is natural | U | Judge: "Is the item the largest thing and lit by daylight?" |
| The name is written one way | M L V U | Script: regex over strings |
| An exception goes to a named person | N U G | Human: Ben |

## 4. Worth borrowing

All *agent proposals*.

| # | Source | Take | Change for us | Why it is good |
|---|---|---|---|---|
| 1 | G, logo elements | One unit from the mark sets clear space, spacing and scale ("The clear space area is defined by the dot size") | Unit is the x-height of the wordmark. Four numbers: clear space, px floor, mm floor, video floor | One measurable unit makes every mark rule a script |
| 2 | G, logo by channel | Profile icon, app icon, a smaller mark for favicons, end frames at 16:9, 9:16 and 1:1 | Draw one short mark; render all from tokens in code | The only source that designs the mark per channel instead of shrinking it |
| 3 | U, composition | "1/3 of the column width = margin", gutter is half the margin, "Logo height = base unit height", headline cap height 1.5 times it | One formula for deck and post from our 4 scale | Ties mark, margin and headline together, so one check covers layout |
| 4 | U, composition | "Reserve U-frames for key moments", "Don't force the U-frame", never two per composition | The field already follows this. Add the formats where the field is left out | A signature device with a stated off switch |
| 5 | G and B, expression range | G: "more muted and reserved" for sensitive topics, "brighter and bolder" for positive. B: one face for function, one for "expressive moments" | Name two or three levels by surface (app: reserved; signed-out site, launch post, sale: bold) and say which codes may scale at each | Gives bold moves a rule and a purpose instead of an exception to E2 |
| 6 | M, voice | Four traits and pairs: "weird but not inappropriate, smart but not snobbish"; "more important to be clear than entertaining" | Three pairs, each one judge line | A pair sets the limit on both sides. An adjective alone cannot be failed |
| 7 | N, incorrect uses | Nine drawn misuses, and "must not be re-drawn, but rather reproduced" from master art | Five misuses, each with its script; one master file | Every item is a visible yes or no |
| 8 | G, charts | Title states the trend; subtitle gives measure, place, time; source line; annotations about 50 characters | Use as is for deck charts; add our type and one color per series | Rules are about the chart's words, so they serve E3 and can be checked from the spec |
| 9 | S, partner rules, read from the other side | What a platform demands of an app showing its mark: size floor, exclusion zone, no altering, "Don't pair brands" | Read each marketplace's own page and write C5's numbers from them | We are the partner here. Our stand-ins and black recolor may break owners' rules |
| 10 | I, 2x grid | Type minimums set by viewing distance | Keep our 4 scale; use it for a deck shown in a room | The only source that reasons about reading distance |

## 5. Not worth it

| Skip | Seen in | Why |
|---|---|---|
| Stationery, forms, signs, vehicles | N, A | We make none |
| Sub-brand and partner logo families | N, G, T | One product |
| An illustration system | G (ten pages), I, U | Art. 8 bans illustration |
| A custom icon set or pictograms | I, U | Hugeicons is chosen |
| Trademark terms for others using our mark | V, L, M, S | Nobody uses it yet |
| Seasonal or secondary palettes | B, U | The ring already is one family |
| Audience segments in the brand file | F | Belongs in product/vision.md |
| A brand portal or asset manager | Frontify | The repo and the ledger do this |
| Full print specification | N | One line of values when the first sticker is ordered |

## 6. What I searched and could not open

Searched: each brand's name with "brand guidelines", "clear space", "minimum size"; studio names with "brand system".

- **Not opened:** the NYCTA manual itself (only [Order's reissue page](https://order.design/project/nycta-graphics-standards-manual-reissue), which credits Vignelli and Noorda of Unimark, 1970, and lists no contents). Duolingo (the page needs JavaScript; a second URL redirected). Slack's brand centre (only the media kit). Dropbox's section pages. Stripe, Polaris. Two searches found no essay by Pentagram, Collins, Wolff Olins, Koto or DesignStudio on what a brand system is; that does not mean none exists.
- **Studio-made manuals:** I asked for two and fully opened one (N). U's studio credit is from memory.
- **Thin reads:** B is an overview that defers to guides not public. F, A, D, I and T have more pages than I opened, so their counts may be low.
- Instrument's essay argues for rules that generate output and gives no checklist. Weak signal only.
- No line was added to a feature page: cross-cutting has none, and I was told to write only this file.
