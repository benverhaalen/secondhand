# How QOVES sets its type

Read from qoves.com's stylesheets on 2026-11-15 with curl, for Ben's ask to "mirror qoves specific fonts and how they tweaked them exactly except for no mono font" ([round 7](../../../product/words.md#2026-11-15-round-7-picks)). Every row is observed in the site's CSS unless marked. No font file was downloaded.

- One family does everything, headings included: PP Neue Montreal. The body rule is `font-family: var(--font-pp-neue); font-weight: 400`.
- Two weights: 400 in 159 rules and 500 in 39. Others appear in 5 rules.
- The mono, F37 Zagma Mono, sets the small uppercase labels. We leave it out.
- Denton and Inter are declared but no rule on the home page uses them. There is no serif in use.
- No rule sets `font-feature-settings`, `font-variation-settings` or `font-variant-numeric`.
- The root size scales with the viewport so that 1 rem is 10 px at 1920, 768 and 375 wide.

| Role | Weight | Size / line height (desktop; phone) | Letter spacing |
|---|---|---|---|
| Hero heading | 400 | 56/64; 32/36 | -0.02em; -0.015em |
| Section heading | 400 | 48/56 | -0.015em |
| Body | 400 | 16/24; 14/20 | 0 |
| Card title | 400 | 24/28; 18/24 | 0 |
| Navigation | 400 | 14/20; 14/18 | 0 |
| Button | 500 | 14/20 | -0.01px |
| Small text | 400 | 12/16 | 0 |
| Big number | 400 | 51.66/59.04, 72/76 | -0.02em, -0.015em |

## How the round 8 sheets use it

The sheets in [inputs/](inputs/) are rendered with headless Chrome from the font files on Ben's Mac (Neue Montreal from Pangram Pangram, the family QOVES serves as PP Neue Montreal; Clofie from 1001fonts; ABC Marist trial). Font files are not committed.

- "Today" at 36: line height 1.125 and -0.015em, QOVES's phone hero settings.
- Titles 18/24, buttons 500 at 15/20, the amount at 50 with -0.02em.
- Interpolated, not observed: 15/22 and 13/17. QOVES has 16/24, 14/20 and 12/16 and no 15 or 13.
- Ours, not QOVES's: tabular figures on money, and "You keep" in sentence case where QOVES would use the uppercase mono.
