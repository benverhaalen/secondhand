# Where Clofie goes, and why

Ben, [round 8](../../../product/words.md#2026-11-15-round-8-picks): "clofie, but some bigger things in the app can be clofie. classify based on expert research what should or shouldn't." The classing is in [constitution Art. 6](../../constitution.md#article-6-type). This page holds what it rests on. Each line is marked observed (read from the file or the page on 2026-11-15), asserted (a source says so) or inferred (my reasoning).

## What the font files say

Read with fontTools on Ben's Mac. No font file is committed.

| | Clofie SemiBold | Neue Montreal Regular |
|---|---|---|
| Glyphs (observed) | 103 | 363 |
| Tabular figures (observed) | None | None |
| Digit widths, 1000 units per em (observed) | 366 (the 1) to 673 (the 0) | 346 to 620 |
| é, ñ, ü, ×, °, –, £, ¥ (observed) | None of them | All of them |
| ″ and ½ (observed) | No | No |
| Features (observed) | `ordn`, `kern` | `aalt`, `ccmp`, `locl`, `salt`, `kern`, `mark`, `mkmk` |

The Clofie zip has nine weights, each with an italic (observed). We use SemiBold only.

## What follows from the files

- Clofie cannot set an item title, a name or a message. A real listing title has accents and signs it lacks, so half a title would fall back to another face (inferred from the glyph list).
- Clofie cannot set an amount. Its digits differ by 307 units, so "$31.40" changing to "$38.00" moves everything after it (inferred from the widths). Ben had already ruled the sale amount out of the display face in round 6.
- Neue Montreal has the same problem with digits, less strongly. The setting `tabular-nums` did nothing on the round 8 and round 9 sheets (observed). The constitution's rule 7 covers it.

## What the sources say

- Apple's Human Interface Guidelines, Typography: "Minimize the number of typefaces you use, even in a highly customized interface." A custom font has to meet the same sizes as the system font: 17 pt by default and 11 pt at the least on iPhone, and it should grow with the person's text size (asserted, [the page](https://developer.apple.com/design/human-interface-guidelines/typography)).
- Pimp my Type, on display text: display sizes start at 20 px, and a face with a strong character is for headlines and short lead lines. "Don't use it for body text, only use it in large sizes." (asserted, [the page](https://pimpmytype.com/display-text/)).
- Material Design 3 names two typefaces, brand and plain, and maps each size role to one of them (observed, [the token list](https://material-web.dev/theming/typography)). Which roles take the brand face by default is not on that page, so we do not lean on it.

## The test

A string is set in Clofie only when all five hold:

1. We wrote it. Not a seller, a buyer or a marketplace.
2. It is 21 px or larger.
3. It fits on one line.
4. It has no digits.
5. It is the only Clofie string in the view besides the wordmark.

Rules 1 and 4 come from the files. Rules 2 and 3 come from the two sources. Rule 5 is inferred: the wordmark is the brand's voice, and a second and third voice in one view would compete with the item's photo, which leads (C3).

The sheets that show it are [inputs/clofie-K1.png](inputs/clofie-K1.png) to [K4](inputs/clofie-K4.png). K2 is what the rules allow: the wordmark and "Today". K3 breaks rule 4 and K4 breaks rules 2 and 4.
