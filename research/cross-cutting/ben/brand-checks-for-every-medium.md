# What is the cheapest reliable way for agents to enforce the brand in every medium?
Researched 2026-11-15 by Ben (Claude Fable 5.2, research helper). Feature: cross-cutting.

Marks: [O] observed (I opened the source or ran it today), [A] asserted (memory, or a second-hand summary), [I] inferred. The web worked. Local runs used this repo's container: Node 22, Playwright 1.63, Pillow, numpy, python-pptx 1.0.2, LibreOffice, ffmpeg. OpenCV and Tesseract are not installed [O].

**Decision it feeds:** how the "Not built" rows in [Part IV](../../../brand/constitution.md#part-iv-checks) get built, and how a deck, a post or a page gets the same checks as an app screen.

**Draft from memory, and what changed:** author everything as HTML, read computed styles, use pixels for the few rules that need them, hand a judge only the rest. That held. Three things changed: matching pixels to the nearest palette color fails on our own field; a .pptx cannot be checked from its file alone; and two tools already do part of this (Google's DESIGN.md CLI, impeccable's detector).

**Already under way:** while I wrote this, an untracked `scripts/brand-check.mjs`, `.agents/checks/render.mjs` and `brand/media.json` appeared in the working tree [O]. They take the same path and name B3 to B17, B20, B21, B23 and B28. I did not review them. Use this note for risk, order and what is left (B18, B19, B22, B26, B27).

## Answer in short

1. **One path.** Every output is HTML that reads `brand/tokens.css`, rendered in Playwright at its Part III canvas. One script writes the facts per view (each text node's size, weight, face, color and background; the rects of photos, fields, pills and cards) and one screenshot. Each DOM rule is a few lines over the facts.
2. **Pixels** only for B8, the B2 assist, B28, and B6 where text sits on a gradient or a photo.
3. **A judge** only for what no script sees, from the fail lines in `.agents/ui-rules.json`, cached by hash.
4. Outputs with no HTML source (a generated picture, a hand-edited deck) get the pixel subset and the judge.

## What I ran [O]

A 390 by 844 page built from `tokens.css`, with a planted 14 px size and planted white text on sky.

| Step | Time | Result |
|---|---|---|
| Launch Chromium, load, screenshot at 2x | 0.8 s | |
| Facts for all text, photos, fields | 6 ms | one field (B4 passes) |
| Size and contrast from the facts | 10 ms | found 14 px; found white on sky at 1.42:1 |
| Color share, photos masked by their rects | 0.13 s | 21.4% (B8 passes) |
| Blur 8 px, heaviest cell of a 13 by 28 grid | 0.06 s | the item photo (B2 passes) |
| Nearest-token match on colored pixels | 0.06 s | 36% "off palette", all of it the field's own blends |
| python-pptx on a new deck | | name, size and bold of placeholder text read `None` |
| LibreOffice .pptx to PDF | 1.5 s | |

About 1.2 s and no tokens per view. Palette membership belongs on computed colors, never on pixels.

## Every "Not built" row

Role tags on the fixed parts and HTML templates (`data-part`, `data-photo`, `data-logo`, `data-view`, as `brand-check.mjs` names them) keep these checks short and their false positives (FP) low [I].

| Id | Cheapest build | Input | FP | Effort |
|---|---|---|---|---|
| B3 | Wordmark part's text equals "secondhand", in the display face, centered within 1 px (app) or placed by medium. Source half exists (picks L3) | DOM | Low | 30 min |
| B4 | Count elements in the view whose computed background is the field; at most 1 | DOM | Low | 20 min |
| B5 | Parse `--field`: three ring hues within 140 degrees, no `repeating-`, no `url()`, no two stops at one position | Tokens | Low | 30 min |
| B6 | Computed color against the nearest opaque ancestor, alpha composited; sample the screenshot behind text on an image or gradient. Then: ink only on fills, white only on ink and brick | DOM, pixels as fallback | Low; medium over photos and stacked layers | 1.5 h |
| B8 | Screenshot, mask photo rects, count pixels over a chroma threshold | Pixels and rects | Low; high on a bare image, where a photo and a fill look alike | 45 min |
| B9 | Every item part holds a loaded image with `alt`, the largest in its group. In the app, make `photo` a required prop | DOM, types | Low | 30 min |
| B10 | Count black pills per card; at most 1, none adjacent | DOM | Low | 20 min |
| B11 | Run the picks L6 name list over rendered text; every logo has a label | DOM | Medium in web prose | 20 min |
| B12 | Money text: text face, no background, `tabular-nums` in a column, other words in its group | DOM | Medium on "has a label" | 45 min |
| B14 | Computed sizes within the medium's set; web at 390 and 1440 | DOM | Low | 20 min |
| B16 | All caps and title case by regex, with an allowlist (platform names, text a person wrote) | DOM or source | High on proper nouns; warn only | 45 min |
| B18 | Largest gap inside a card against the gap to its sibling | DOM | Medium | 1.5 h; keep judge line P12 |
| B19 | A boxed element (border, fill or shadow) inside another, except photos, pills and buttons | DOM | Medium | 45 min |
| B21 | Bordered cards and shadowed cards not both in one view; the pill glow is exempt | DOM | Low | 20 min |
| B22 | Icons import only from the Hugeicons package; no inline `<svg>` outside the parts and `assets/platforms` | Source | Low | 15 min |
| B26 | Captions are data (text, start, end) in the timeline or a .vtt file; the rule is arithmetic | Timeline | Low | 30 min |
| B27 | Regex for a currency sign beside a digit or `${` outside the money part; `toFixed(2)` | Source | Low to medium | 20 min |
| B28 | Read the PNG header: the medium's canvas times a whole number | Pixels | None | 10 min |

Half-built rows: B7, B13 and B15 become rendered checks from the same facts (15 min each), and B17's canvas margins come from the rects (30 min). B2 stays a Look with the blur result attached as a warning, since the black pill is often the darkest mass [I].

## One path for non-app media

**A. HTML first (recommended).** Author in HTML with the tokens, render, take the facts and a screenshot, and export the PNG, PDF or frames from the same page. It sees exact faces, weights, sizes, colors, roles and rects, at about 1 s and no tokens per view [O]. It cannot see outputs we did not author in HTML.

**B. Image first.** Export anything to an image, then pixels, OCR and a judge. It sees color share, canvas size and rough mass, but not faces, weights, exact sizes or what is a photo; OCR is flaky on display type [A]. Most rules cost a judge call.

| Medium | Source | Render | Ships as |
|---|---|---|---|
| App | The screen through Expo web (`react-native-web` is in `app/package.json` [O]) | 390 by 844 | The native app; haptics and Dynamic Type stay with Maestro and the judge |
| Website | The page | 390 and 1440 | Itself |
| Deck | One section per slide | 1920 by 1080 | PDF from the page |
| Post | One section per slide | 1080 by 1350 | PNG |
| Video | HTML scenes and a timeline file | Sampled frames | Frames to ffmpeg |
| Document | HTML | Pages | PDF |

The tradeoff: A checks only what we author this way, and a web render of a React Native screen is not the device. That is fine because the rules are about values and roles, not exact pixels [I]. A .pptx is an export, never a source: python-pptx returns `None` for anything inherited from the theme [O].

## Rule schema

Add optional fields to rows in `.agents/ui-rules.json`. Old rows stay valid.

```json
{ "id": "B8", "kind": "check", "by": "render:B8", "on": "pixels",
  "media": ["app", "web", "post", "deck", "video"], "severity": "error",
  "src": "brand/constitution.md B8", "retire": "Art. 5.2 changes" }
{ "id": "B25", "kind": "judge", "media": ["web", "post", "deck"], "severity": "warn",
  "fail": "Fail if the output matches the no-brand default on three or more of: palette, type, grid, card shape, icon style, copy pattern, image style." }
```

| Field | Values | Default |
|---|---|---|
| `media` | The keys of `brand/media.json`, plus `doc` | All |
| `on` | `source`, `dom`, `pixels`, `timeline` | `source` |
| `severity` | `error` blocks; `warn` is a question | `error` |
| `src` | The rule's id, or the anchor of Ben's words | None |
| `retire` | When the row can go | None |

`by: "render:<id>"` mirrors `picks:<id>`: a check in `render.mjs` with a test named `render <id>:`. `rules.mjs` then accepts that holder, validates `media`, and filters `judgeBrief` by medium. Shape borrowed from DESIGN.md findings, `{severity, path, message}` [O]; impeccable's ignores by rule id with a reason [O]; axe's `impact` and SARIF's `level` [A].

## Judge lines: rules of thumb

1. **A script first.** Anthropic's eval guide: "Automate when possible" [O]. Claude Code docs: hooks "are deterministic"; instructions are advisory [O].
2. **One yes or no per line, tuned against Ben's verdicts.** Hamel Husain: pass or fail with a critique, refined until the judge matches one expert [A, from Simon Willison's summary]. WebDevJudge: binary rubrics beat Likert scales [A, from a review].
3. **Demand evidence.** A fail names the element and where it is, or it is dropped. "Have Claude show evidence rather than asserting success" [O].
4. **Fresh context, and a different model from the maker.** "A fresh context improves code review since Claude won't be biased toward code it just wrote" [O]. Judges "can be more than 50% more likely" to wrongly pass their own output, most on negative rubrics, which "Fail if" lines are (Pombal et al., 2026) [O].
5. **Shuffle the lines.** Criterion order shifts scores, and a few random orders cut the error (Xu et al., 2026) [O]. Swap sides in a pair (Zheng et al., 2023) [O].
6. **Compare against a reference; never ask for an absolute score.** Pairwise beat single grading by about 8 points [A]. Model ratings correlate with people near 0.7 overall but go negative on ease of use and comfort (Luera et al., 2025) [O].
7. **Say what does not count.** "A reviewer prompted to find gaps will usually report some, even when the work is sound" [O]. Only a listed line can fail an output.
8. **Never judge the same thing twice.** Key the verdict on a hash of the output, the line and the model. ESLint hashes file contents for CI, where file times do not survive [O]; using that for judges is my step [I].

The best judge agreed with experts 66% of the time, against 85% between people (WebDevJudge) [A]. A judge line is a filter before Ben, not a verdict.

## Tokens: is the W3C format worth it now?

Design Tokens Format 2025.10 is the first stable version, a Final Community Group Report of 2025-10-28 with Format, Color and Resolver modules, and no newer version is listed today [O]. Style Dictionary has "first-class support" since v4 and writes iOS, Android, CSS and JS; Terrazzo writes CSS, Sass, JS, Swift and Tailwind and lints tokens; Tokens Studio is a reference implementation [O].

Not now [I]. `tokens.css`, `scripts/tokens-to-ts.mjs` and the parts check already give one source for CSS and React Native, and an HTML deck or post reads `tokens.css` with no build. The format adds a build step and a second syntax, and `--field` (layered radial gradients), the `clamp()` sizes and `--pill-glow` would need custom handling [A]. Revisit if Figma or a Swift target arrives; a one-way export is then about an hour.

## Worth borrowing

| # | Source | Take |
|---|---|---|
| 1 | [DESIGN.md CLI](https://cdn.jsdelivr.net/gh/google-labs-code/design.md@main/README.md), Google Labs, alpha [O] | Its `diff`: compare tokens across two commits and flag a regression. Not the format |
| 2 | [impeccable](https://github.com/pbakaus/impeccable) `detect` [O] | A free warning pass on the website for Article 13 tells: no model, JSON out, scans a URL. Allowlist with a reason where it fights a pick |
| 3 | [Vercel web interface guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) [O] | About 100 terse rules and a `file:line` finding format: the format for judge output, the list for the website's interaction pass |
| 4 | [Primer stylelint plugins](https://cdn.jsdelivr.net/npm/@primer/stylelint-config@13.6.0/plugins/README.md) [O] | A replacements map, so an error names the token ("16px, use --s-4"). Add to `brand.mjs` messages. Stylelint itself only if the website gets real CSS files |
| 5 | [axe color-contrast](https://dequeuniversity.com/rules/axe/4.9/color-contrast) [O] | Run axe on the website, but it "will not report" text on a background image, so keep our own B6 |
| 6 | Playwright screenshots, per [Argos](https://argos-ci.com/blog/playwright-visual-regression-testing-ci) [O] | Pixel diffs only for fixed parts (tab bar, header), with masks and baselines made in the same container |
| 7 | [Templafy Check](https://support.templafy.com/hc/en-us/articles/360011493578-Check-for-PowerPoint-rules) [O] | Six deck rules: number of fonts, number of sizes, off-scheme color, content outside the slide, overlapping text, distorted image |
| 8 | [GOV.UK](https://docs.publishing.service.gov.uk/repos/govuk_publishing_components/testing-components.html) and [Carbon](https://carbondesignsystem.com/contributing/component-checklist) [O] | Test each part once on a gallery page (axe plus a visual check of the default state); a person approves visual changes |
| 9 | [Adobe GenStudio](https://experienceleague.adobe.com/en/docs/genstudio-for-performance-marketing/user-guide/guidelines/brand-validation) [O] | The report: passed over tested, grouped as "Needs review" and "Passed" |

Anthropic's frontend-design skill is prose with no checks [O, from a listing page that was cut short]. Emil Kowalski's skills are mistake and fix pairs [O, repo page only]. Neither adds a mechanism.

## What not to build

| Skip | Why |
|---|---|
| A move to the W3C format or Style Dictionary | No new output for two people |
| OCR for text size; logo detection by template match | Not installed, flaky [A], and the DOM already knows |
| Palette membership from pixels | False alarm on our own field [O] |
| Whole-screen pixel diffs | Fonts and antialiasing differ by machine [O], and content changes every screen |
| B18 as a script | 1.5 h and medium false positives; judge line P12 holds it |
| Checking a .pptx as a source | Inherited values read as `None` [O] |
| Judge scores from 1 to 5 | Rules 2 and 6 |
| A commercial brand tool | Frontify's reviewer is plain-language tasks run by a model, "still in development" [O]; Templafy checks against a master template we do not have |

## Searched, and could not open

Searched: the token format, Style Dictionary, Terrazzo, stylelint plugins, Polaris, Primer, Carbon, GOV.UK, Figma linters, axe, Playwright screenshots, python-pptx, slide linters, Templafy, Frontify, Adobe GenStudio, judge bias papers, agent design skills, ESLint's cache.

Not opened, or read only in part: Polaris's stylelint docs (redirected); Playwright's own snapshot docs; Hamel Husain's post; WebDevJudge beyond its abstract; the full skill files of frontend-design and Emil Kowalski; the grading section of Anthropic's eval guide. Not searched: Brandfolder, Canva brand kit. The one open-source slide linter found, [pptx-lint](https://pypi.org/project/pptx-lint/) 0.2.0, checks layout only [O]. A narrow search does not show that nothing else exists.
