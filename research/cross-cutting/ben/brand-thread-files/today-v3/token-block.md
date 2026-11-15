# Token block for the brand identity thread (from the critique thread, 2026-11-15)

Ben approved the dark mode and the size system at 02:18 (product/words.md, "dark mode approved"). Values below are measured in today-light-dark.png.

## Light
- `--page: #F1F3F5` (OKLCH L .963; white cards on it are 1.11:1, the dark pair's contrast mirrored). R29 option 2.
- `--surface: #FFFFFF`
- `--shadow-card: 0 1px 2px rgb(10 10 10/.06), 0 6px 20px rgb(10 10 10/.07)` (light only, and no hairline with it: Art. 9.2 allows one of the two)
- `--ink-2: rgb(10 10 10/.62)` (5.0:1 on the sky field, 5.4:1 on the page)
- `--sec-on-field: rgb(255 255 255/.72)`
- `--wash: radial-gradient(120% 90% at 15% 0%, rgb(165 225 254/.55), transparent 70%), radial-gradient(90% 80% at 95% 0%, rgb(161 234 203/.45), transparent 70%)`, 280 tall, behind the header only

## Dark
- `--page: #101315` · `--surface: #1A1D20` (1.10:1 on the page) · `--gray: #2A2F32`
- `--ink: #ECEFF1` · `--ink-2: #B4BABD`, and `#CDD2D4` on the field (6.1:1, Lc 66)
- `--rule: rgb(255 255 255/.12)` · card edge `inset 0 0 0 1px rgb(255 255 255/.08)` · no shadow, no glow
- `--act: #ECEFF1` with `#0A0A0A` text
- `--sec-on-field: rgb(255 255 255/.14)`
- field: sky `#0A4C65` base, mint `#03523B` at 30% 100%, aqua `#025050` at 100% 100%. No lime in dark.
- wash: as light with `rgb(10 76 101/.55)` and `rgb(3 82 59/.45)`
- photos `filter: brightness(.92)`
- state tags and other small marks keep their light fills with `#0A0A0A` text
- lime and marigold never become a dark ground (dark yellow is brown; Ben is color blind)

## Sizes
| part | size | radius | inside |
|---|---|---|---|
| card-decision | 350 x 156 | 36 | pad 16; row 72 (tag 20, title 18/24 Book, detail 15/20); gap 12; action band 40 |
| card-item | 350 x 104 | 36 | pad 16; row 72 |
| photo-thumb | 72 | 20 (36 − 16) | |
| site-badge | 24 (20 logo + 2 ring in the surface color) | 12 | on the photo's bottom-right corner, offset −4 |
| tag-kind | content x 20 | 10 | icon 12 inset 4, text 13, end pad 8 |
| notice | 350 x 56 | 28 | pad 16 left, 12 right; icon 24, 15/20, chevron 20 |
| pill-card | content x 40 | 20 | pad 20 |
| pill-icon | 40 | 20 | |
| nav | 350 x 44 | | wordmark left, inbox right in a 44 target |
| badge (count) | min 20 x 20 | 10 | 13 medium, ring 2 in the page color |

Gaps: 12 inside a card, 16 between cards, 32 between sections (40 is not on the scale), 8 from the nav to the summary.
