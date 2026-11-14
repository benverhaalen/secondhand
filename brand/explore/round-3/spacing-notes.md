# Spacing, type and sizing rules from Emil Kowalski's files

Source: `~/.local/share/harness/vendor/emil`, Emil Kowalski's skill repo at commit f7ce8c0 (2026-11-12), MIT. Read on 2026-11-14: `emil-design-eng/SKILL.md`, `apple-design/SKILL.md`, `ui-cheatsheet.md`, `review-animations/STANDARDS.md`. Every other file in the folder was searched for the same topics; matches are listed under "Elsewhere in the folder".

The named files are mostly about motion. They give **no** spacing scale, type scale, weight ladder, radius values or button heights. What they do give is below.

## Type: tracking (letter spacing)

| Rule | File |
|---|---|
| Large headings: "Tighter tracking like `-0.02em`" | ui-cheatsheet.md |
| "Tracking (letter-spacing) is size-specific — never one value for all sizes." Large text gets negative tracking, small text slightly positive. | apple-design §15 |
| "Tighten headings, leave body near `0`." | apple-design §15 |
| Display example: `letter-spacing: -0.02em` with `font-size: clamp(2rem, 5vw, 4rem)` | apple-design §15 |
| Text over blur or translucency: higher contrast, slightly heavier weight, "a small letter-spacing bump" | apple-design §12 |

## Type: line height and measure

| Rule | File |
|---|---|
| "Leading (line-height) tracks size inversely." Tight on large headings, looser on body. | apple-design §15 |
| Tighten leading "for dense, information-heavy UI"; loosen it for scripts with tall ascenders and descenders | apple-design §15 |
| Display example `line-height: 1.05`; body example `font: 100%/1.5 system-ui` | apple-design §15 |
| Body line length: "about 65 characters with `max-width: 65ch`" | ui-cheatsheet.md |

## Type: size, weight and hierarchy

| Rule | File |
|---|---|
| "Build hierarchy from weight + size + leading as a set," not size alone | apple-design §15 |
| "Emphasize with weight — it adds presence without taking more space." | apple-design §15 |
| Scale layout with the user's text size: "spacing in `rem`/`em`, not fixed px" | apple-design §15 |
| Default to the system font first; "Override only with a reason." | apple-design §15 |
| `font-optical-sizing: auto` on display text | apple-design §15 |
| Changing numbers: `font-variant-numeric: tabular-nums` | ui-cheatsheet.md |

Note for this project: the weight rule conflicts with the round-2 brief (hierarchy from luminance, not bold). Ben's brief wins; the rule is recorded here, not adopted.

## Spacing and layout

| Rule | File |
|---|---|
| Hierarchy comes from "order, spacing, contrast" so "the most important thing is the most obvious" | apple-design §16.6 |
| "Nothing is random — every spacing, timing, and alignment value is a deliberate choice you can defend." | apple-design §16.7 |
| Proximity implies relationship; put a control next to what it changes | apple-design §16 |
| Under a sticky header, a soft blur or gradient mask instead of a 1px border, only where content actually scrolls under it | apple-design §12 |

## Buttons and hit targets

| Rule | File |
|---|---|
| Pressed state: `transform: scale(0.97)` on `:active`; "subtle (0.95-0.98)" | emil-design-eng, ui-cheatsheet.md, apple-design §1 |
| Show the press on pointer-down, commit on release | apple-design §1, §10 |
| About 10px of extra hit padding around a tap target | apple-design §10 |
| `scale()` also scales the label and icon, which is wanted for press feedback | emil-design-eng, STANDARDS.md |

## Radius and materials

| Rule | File |
|---|---|
| No radius values are given. Radius appears only as a costly property to animate. | animation-performance/SKILL.md |
| Bigger surfaces read as thicker: stronger blur and deeper shadow than small chips | apple-design §12 |
| Never stack one light translucent surface on another | apple-design §12 |

## Optical alignment

| Rule | File |
|---|---|
| Only a general rule: "misaligned icons" read as carelessness | apple-design §16.7 |
| No concrete optical-alignment rules (icon nudges, cap-height alignment, concentric radii) in these files | — |

## Elsewhere in the folder

| Rule | File |
|---|---|
| "Hit targets ≥ 44×44px." Grow small targets with an invisible `::before` hitbox, not the layout | gestures/SKILL.md |
| Fixed headers, tab bars, toasts and sheets pad with `env(safe-area-inset-*)`, with a fallback in `calc()` | mobile-native/SKILL.md |
| Judge variants one at a time at full size; side-by-side thumbnails "distort spacing and scale" | prototype/SKILL.md |
| Tight `line-height` with `overflow: hidden` clips stacked diacritics | break-ui/CATALOG.md |
| Example values only (the picker's own CSS, not stated as rules): pill 28px tall, 12px side padding, radius 999px, 13px text at line-height 1, 4px container padding, 2px gap | prototype/PICKER.md |
