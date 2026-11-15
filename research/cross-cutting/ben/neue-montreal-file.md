# Which Neue Montreal file gives tabular figures and full glyph coverage?
Researched 2026-11-14 by Ben (Claude, Opus 5.5 in Claude Code on Ben's Mac). Feature: cross-cutting (brand type).

Ben, 00:50 UTC: "find a way to engineer around the neue montreal thing."

## The problem

The Neue Montreal used for rounds 7 to 9 came from `~/Downloads/Neue Montreal.zip` (Pangram Pangram, version 1.000, 363 glyphs). *Observed* with fontTools: no `tnum` feature, digit widths differ (Regular: 1 = 346 units, 0 = 620), no ½ and no ″. So `font-variant-numeric: tabular-nums` did nothing, and amounts that change shift sideways.

## The fix: the full PP Neue Montreal 2.6 file Ben already has

`~/Downloads/neue-montreal-v2-0-font-family(1).zip` holds PP Neue Montreal version 2.600 (Book 400, Medium 500, Bold, Thin, Italic, SemiBold Italic). *Observed* with fontTools:

| | Old file (1.000) | PP Neue Montreal 2.600 |
|---|---|---|
| Glyphs | 363 | 742 |
| Features | aalt ccmp locl salt, kern mark mkmk | adds tnum, pnum, frac, numr, dnom, case, zero, sups, subs, ss01, ss02, liga, dlig, cpsp, ordn |
| Tabular digit width (units of 1000) | none | Book 670, Medium 723, all ten digits equal |
| ½ | no | yes |
| ″ (U+2033) | no | no |

*Observed* in headless Chrome with tabular figures on at 50 px: $31.40, $11.11 and $88.88 each measure 166.35 px in the 2.600 file; in the old file they measure 136.41, 97.05 and 149.66 px. Proof: [neue-montreal-proof.png](neue-montreal-proof.png).

QOVES serves this family under the same name, "PP Neue Montreal" (*observed* in qoves.com's `@font-face` rules, round 8). The Book weight is the 400 QOVES uses.

## How to use it (agent proposal)

1. Load PP Neue Montreal 2.600 Book (400) and Medium (500) as the text face. Keep the font files out of git, as for every font in this repo.
2. Tabular figures only where a number changes in place or sits in a column: a live countdown, a running total, a price list. A single large amount reads better in the default proportional figures; in the proof the tabular "1" sits in a 670-unit slot and `$11.11` looks gappy (*observed*).
3. Put the system face after it in the stack so missing characters fall back per glyph. The ″ for inches in Measure renders from SF Pro this way (*observed* in the proof). Use `-apple-system` rather than `system-ui`, which tokens.css avoids.
4. `frac` gives real fractions such as 32½ in sizes; `case` raises punctuation for all-caps, which the brand does not use.

## Limits

- The 2.600 zip came from befonts.com and its licence file says "Personal Use Only". Ben ruled licences out of scope for the hackathon demo ([words](../../../product/words.md#2026-11-14-licences)); shipping needs a licence from Pangram Pangram (*asserted*).
- The zip has no Regular or SemiBold upright, only Book, Medium, Bold and Thin among uprights (*observed*). QOVES's 450 weight is not in it.
- Only the Book and Medium files were checked for the tabular widths above.
