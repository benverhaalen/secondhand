# An open fallback pair for the two brand faces

Decision brief. Status: **agent proposal**, for Ben to judge by eye. Nothing here is Decided.

**Ask** (Nate, 2026-11-15, [words](../../../product/words.md#2026-11-15-nate-set-up-treg-for-the-tools-identification-needs-an-open-font-for-every-system)): "For the mac only font, add a google font found equivalent in style built to support all systems". PP Neue Montreal and Clofie are licensed files that are never committed, so a checkout without them drew San Francisco or Noto. This picks one open face per role to draw there. Where the brand files exist they still win.

**Not available: a side-by-side.** The brand files are not on the machine that wrote this and cannot be committed, so no candidate was set against them. The comparison uses the numbers the repo already records from Ben's Mac ([brand-round-11](../../../research/cross-cutting/ben/brand-round-11.md), fontTools) and the candidates measured the same way. Judging them against the real faces is the one thing left for the eye.

## Brand numbers (recorded)

| | PP Neue Montreal Medium | Clofie SemiBold |
|---|---|---|
| UPM | 1000 | 1000 |
| Ascent / descent / gap | 958 / -242 / 0 | 750 / -250 / 100 |
| Cap height / x height | .715 / .510 | .725 / .500 |
| Tabular digit width | 723 (Medium) | none |
| Has | the six Article 6.11 characters and an arrow | letters and the apostrophe only (103 glyphs) |

## Rules every candidate had to pass

Open licence (SIL OFL) with no Reserved Font Name; not Inter; one family per role; static at one weight, so nothing is faked; has the characters Article 6.11 lists: ’ × − ½ … – →; bundled, never fetched at run time.

## Text candidates, at wght 500 (Medium)

Fractions of the em, measured with fontTools on the official files from google/fonts, instanced at 500. "Digit spread" is the widest digit minus the narrowest, in font units (0 means the digits are already tabular).

| Family | UPM | x-height | cap | avg lowercase | avg digit | digit spread | tnum | Missing of ’ × − ½ … – → |
|---|---|---|---|---|---|---|---|---|
| **Hanken Grotesk** | 1000 | .493 | .697 | .506 | .560 | 0 | no (not needed) | none |
| Instrument Sans | 1000 | .510 | .720 | .534 | .573 | 282 | yes | ½ |
| Schibsted Grotesk | 2048 | .527 | .703 | .537 | .565 | 526 | yes | none |
| Albert Sans | 1000 | .500 | .700 | .518 | .582 | 340 | no | → |
| Figtree | 1000 | .500 | .700 | .513 | .566 | 227 | yes | none |
| Geist | 1000 | .532 | .710 | .549 | .597 | 267 | yes | none |
| Host Grotesk | 1000 | .496 | .700 | .521 | .650 | 0 | no | none |

Why Hanken Grotesk: it covers every character, its x-height (.493) is within 3.5 percent of PP Neue Montreal's (.510) and a size-adjust of 103.45 percent closes the gap (cap height then .721 against .715). Its digits are all one width, so money lines up with no feature. It is a neutral grotesk with a straight, even stroke, like Neue Montreal. Instrument Sans is closest on raw height but has no ½. Geist's x-height is too tall. Schibsted draws a serifed capital I. Host Grotesk's digits are .650 wide, far from .560 to .580.

Known differences from PP Neue Montreal (measured or seen): Hanken's capital I stem is about 102 against 98, its l has a tail where Neue Montreal's is straight, and its 1 has a looser gap. At 13 to 18 px these are small; at 50 they show.

## Display candidates, at wght 600 (SemiBold)

| Family | UPM | x-height | cap | ascent / descent / gap | tnum | Missing | l stem, units |
|---|---|---|---|---|---|---|---|
| **Outfit** | 1000 | .483 | .703 | 1000 / -260 / 0 | yes | none | 131 |
| Urbanist | 2000 | .500 | .700 | 1900 / -500 / 0 | no | none | 104 |
| Poppins (official static) | 1000 | .554 | .701 | 1050 / -350 / 100 | no | → | 140 |
| Plus Jakarta Sans | 1000 | .541 | .745 | 1038 / -222 / 0 | yes | none | 113 |
| Red Hat Display | 1000 | .509 | .700 | 1018 / -305 / 0 | yes | → | 101 |
| Lexend | 1000 | .525 | .700 | 1000 / -250 / 0 | no | → | 142 |
| Sora | 1000 | .534 | .730 | 970 / -290 / 0 | yes | → | n/a |
| Jost | 1000 | .460 | .700 | 1070 / -375 / 0 | yes | → | 130 |

Why Outfit: it covers every character, it is a geometric, single-storey-leaning, friendly sans like Clofie, and at 600 it is a genuinely heavy stem (131 units, in line with Poppins and Lexend). Urbanist, Plus Jakarta Sans and Red Hat Display render lighter at the same nominal weight (stems 101 to 113), which would read as the wrong weight against a SemiBold brand face. Its x-height .483 against .500 is closed by a size-adjust of 103.5 percent. Poppins is rejected on x-height (.554, much larger than Clofie's) and the missing arrow.

Only the wordmark and titles at 21 and 36 use the display face, all lowercase, with no digits (Article 6), so digit and arrow coverage matters little there; coverage was kept as a rule anyway because the face is also the first fallback if a title ever carries one.

## The pick (agent proposal)

- Text: **Hanken Grotesk Medium (500)**, in place of PP Neue Montreal.
- Display: **Outfit SemiBold (600)**, in place of Clofie.
- Two families, one weight each. Noto stays last for scripts neither has.

## How it is wired

- Files: `app/assets/fonts-open/hanken-grotesk/HankenGrotesk-Medium.ttf` and `app/assets/fonts-open/outfit/Outfit-SemiBold.ttf`, each folder with its `OFL.txt`. The website carries byte-identical copies in `web/public/fonts-open/` because a deploy uploads only `web/` (`scripts/fonts.test.mjs` checks they match).
- **Statics were cut from the variable files.** Google ships both families as variable fonts; only Poppins has official static files. The two statics were made with fontTools `instancer` at wght 500 and 600 from the official `google/fonts` files, then renamed (static names, weight class set, STAT dropped). The licence allows this and there is no Reserved Font Name; if Ben would rather have a foundry-built static, none exists for these two.
- Stacks (`brand/tokens.css`): `--font-text` is PP Neue Montreal, Hanken Grotesk, Noto...; `--font-display` is Clofie, Outfit, then the text stack.
- Web: `@font-face` at the one weight with `size-adjust` (103.45 and 103.5 percent) and `ascent-override`, `descent-override`, `line-gap-override` set to the brand's metrics divided by it (text 92.6 / 23.4 / 0; display 72.5 / 24.2 / 9.7), so lines sit where the brand's do.
- Phone: `app/src/ui/fonts.ts` loads the open face when the brand file is missing. A phone has no CSS overrides, so there the faces draw at their own size and metrics (see below).

## Specimen

[specimen.png](specimen.png), from [specimen.html](specimen.html) by [render.mjs](render.mjs): only the open pair, at the app's sizes: the wordmark, a tab label, prices, a truncating title, each special character at 13, 15, 18 and 50. Read by eye: nothing clips, every character has a glyph, both weights are real (no faux bold), the ellipsis truncates inside the dashed edge.

## For Ben to judge by eye

Open the specimen beside the app drawn in the real faces. Does Outfit read as Clofie's cousin at 36 (the wordmark), and does Hanken Grotesk read as Neue Montreal's at 13 to 18? If either is wrong, the table above has the next candidate for that role (Instrument Sans needs a ½ drawn from another source, so Figtree is the text runner-up; Lexend or Jost for display, each missing the arrow, which the display role does not use).

## Not verified

- No side-by-side against the real brand faces.
- No phone run: Outfit's native ascent and descent (1000 / -260) differ from Clofie's (750 / -250 / 100), and the screens lift Clofie by `--nudge-display` (.12em) in `app/src/ui/text.tsx` and `chrome.tsx`. With Outfit that lift may be wrong on a phone; check it on a device.
