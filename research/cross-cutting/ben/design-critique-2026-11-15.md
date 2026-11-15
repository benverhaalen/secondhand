# What would an expert designer critique in the secondhand design system?
Researched 2026-11-15 by Ben (Claude Code, thread "Critique the design system and plan dark mode"). Feature: cross-cutting (brand).

Marks: what our files say is *observed* (read in the repo on 2026-11-15); the judgments are *inferred*; outside guidance is *asserted* unless a later note in this set opened it.

A fresh read of `brand/tokens.css`, `brand/constitution.md`, `brand/ledger.md`, `product/ui-constitution.md`, `app/src/ui/`, the round 7 boards, the round 8 and 9 real-font sheets, and the round 8 picks page. Nothing in the repo was changed. Fixes go to the brand thread once Ben agrees.

What I measured is marked *measured*. What I read off a render is marked *seen*. The rest is reasoning from the principle named.

The round 7 boards are image-model renders with the old serif wordmark, so I used them only for layout. Type and spacing judgments come from the real-font sheets (`brand/explore/round-8/inputs/type-W2.png`, `brand/explore/round-9/inputs/clofie-K2.png`).

## The short version

Nothing here is a matter of taste. Two rules, each sensible alone, combine to make the app feel unfinished:

1. **Every color is too light to be used small.** So color can only show up as big fills. Big fills are capped at a third of the screen and one field per view. So most screens end up black, white and gray with one gradient card.
2. **Weight is banned for hierarchy.** So at app sizes (13 to 18) the only lever left is 65% gray, and a title and its details read as one thing at two volumes. Above that, the scale jumps from 18 straight to 36.

Fix those two and most of the "off" feeling goes. The rest is spacing and corners that don't follow their own rules.

## Ranked

### 1. The palette has no middle

*Measured:* all eight hues sit at OKLCH lightness .88 (lime .93) and chroma .065 to .12. Against white they are 1.2 to 1.5 to 1. The ink is at lightness .15. Nothing in the system lives between .42 and .88 except brick and the unread dot.

Why it matters: WCAG 1.4.11 asks 3 to 1 for marks that carry meaning (icons, dots, lines). A color at 1.4 to 1 can't be an icon or a dot on white, which is why Art. 5.1 had to ban color on white. With color allowed only as area, and area capped, the brand disappears off the field. Equal lightness and chroma across all eight hues also means no hue leads: there is no "secondhand color" the way Depop has its red or Vinted its teal. HIG's own palette works the other way: each system color is a mid-tone that works as a tint on text, icons and controls.

The deep step (lightness .42, chroma .07 to .11) exists but nothing uses it, and at that chroma it reads as olive, khaki and teal-gray.

**Fix.** Replace the deep step with a mark step at OKLCH L .58, chroma up to .15, clipped to gamut. Each passes 4 to 1 on white:

| Hue | Mark | On white |
|---|---|---|
| sky | `#0286B0` | 4.2 |
| aqua | `#068C8C` | 4.1 |
| mint | `#02906A` | 4.0 |
| lime | `#7E8005` | 4.2 |
| marigold | `#9F7100` | 4.3 |
| peach | `#B85F00` | 4.5 |
| pink | `#BF4D70` | 4.7 |
| lilac | `#8862C6` | 4.6 |

Use marks for small things only: the icon in a state tag, a state dot on a photo, a progress bar, a price-change arrow. Never for text blocks. This is R18 option B; I agree with the agent lean. Yellow hues go olive at mid lightness (lime, marigold); that's physics, and on a tint behind them it reads fine.

### 2. Type hierarchy is flat where the app lives and jumps where it doesn't

*Measured:* app sizes are 13, 15, 18, 21, 36, 50. Steps are 1.15, 1.20, 1.17, then 1.71. But 21 is the wordmark only, so in practice text goes 13, 15, 18, then doubles to 36. `layout.tsx` gives a section title the same role as a card headline (18, 400, ink), so a section and a card read the same.

Art. 6.1 allows weight 500 only on buttons and the selected tab. That comes from QOVES, which is an editorial site where sizes differ 3 to 5 times. In an app row, sizes differ 15 to 20%, and with one weight the only thing separating "Carhartt Detroit jacket" from "Listed at $45" is 65% gray. HIG's text styles use weight, size and label color together (Headline is 17 semibold, Body is 17 regular, details in secondaryLabel). The round 3 "janky bolding" was medium beside regular at nearly the same size and the same ink. The fault was changing one property only; the fix is to change all three, not to ban weight.

Rows are also small. 15 maps to Dynamic Type's subheadline, and HIG's default body is 17. Ben called the smallest sizes in the round 7 examples "far too small".

**Fix.**

| Role | Size | Weight | Ink |
|---|---|---|---|
| Caption, time | 13 | 400 | ink-2 |
| Details, body | 15 | 400 | ink-2 for details, ink for body |
| Name of a thing (row title, card headline) | 17 | 500 | ink |
| Section title | 22 | 500 | ink |
| Screen title | 34 | 500 | ink |
| Peak amount | 50 | 400 | ink |

15 to 17 is under the 15% rule, but the rule exists only because weight was banned. With weight and ink changing too, the step reads as meant.

### 3. Two near-identical sans, and two headers, at the top of every screen

*Seen* in `clofie-K2.png`: the wordmark centered at 21, then "Today" left at 36 in Clofie, then Neue Montreal for everything else. Clofie is geometric and Neue Montreal is a grotesk; they are close enough that side by side the difference reads as an error, not a choice. Pairs work when they match or clearly contrast.

The wordmark plus a large title are two headers with two alignments, taking about 100 pt of an 844 pt screen before the first item. That works against "one focal point per view" (Art. 1.4) and E1 (the item leads).

**Fix.** Clofie sets the wordmark, and web and post headlines at 50 and up, where its character shows. The screen title is Neue Montreal 500 at 34. Home shows the wordmark in place of "Today" (the Instagram and Threads pattern); the other tabs show their large title and no wordmark. This amends L3 and A7, so it's Ben's call.

### 4. Spacing doesn't group

*Measured* in `app/src/ui/layout.tsx`: a `Card` puts 12 between its parts, and a `Section` puts 12 between its cards. Inside equals between, which breaks Art. 7.2 in code.

*Seen* in `clofie-K2.png`: "You keep $31.40" sits 32 below the Nike Dunks row and 24 below the card above it, so it belongs to neither. That's the "scattered info" Ben named in round 7.

*Measured:* two content edges. Card content sits at gutter plus 16; rows, the amount and the title sit at the gutter. Art. 7.5 asks for one start edge per column.

**Fix.** Parts of one thing 8, siblings 16, sections 40. The amount goes inside its item's group. Every surface edge sits at the gutter and every content edge at gutter plus 16, so rows take the same 16 inset as cards (the Settings pattern). This is R19; I agree.

### 5. Corners don't nest

A 48 pt pill (radius 24) sits inside a card of radius 14 with 16 padding, so the inner corner is rounder than the outer one. Concentric corners need outer radius = inner radius + padding.

**Fix.** Cards that hold buttons: radius 32, padding 12, in-card pills 40 tall (hit area stays 44). 32 = 20 + 12. A photo set directly in a card corner takes 32 − 12 = 20. Photos inside rows keep 8.

### 6. Gray means six things, and the hairline is too faint to mean one

`--gray` is the ended state, the disabled fill, the skeleton, the secondary button, the notice card, and (if R16 goes gray box) every feed item. A gray box around a live item reads as ended or loading.

*Measured:* `--rule` at 8% is 1.19 to 1 on white. iOS's separator (#C6C6C8) is about 1.7 to 1. The card border is the only thing that says "this asks you something" (`layout.tsx`), and it's the faintest mark on the screen.

**Fix.** R16: the white box with a hairline, not gray. `--rule` to 12% for hairlines and card borders. Gray keeps ended, disabled, skeleton and the secondary button only.

### 7. The field's colors are the state colors

Sky, mint and lime mean shipping, live and sold. The field sits behind "Offered $38", which is a needs-you item whose state color is marigold. Art. 5.3 says one color means one thing; the brand's main color event breaks it on the most important card.

**Fix.** Make the field itself the needs-you signal (it already goes only "behind the decision that needs you"), and drop marigold as a state fill. State tags become tint plus a mark-step icon from item 1, so they read as labels, not pieces of the gradient.

### 8. The glow is on the tell list, and only shows in one place

`--pill-glow` (sky at 55%, lime at 70%) is a colored glow, which Art. 13 lists as an AI tell. On the field, where the main pill lives, it vanishes. On white it's a halo. Depth that shows in only one context isn't a system.

**Fix.** Keep the glow Ben picked, at a third of the strength: `0 6px 18px rgb(129 207 252 / .2), 0 2px 8px rgb(238 243 151 / .25)`, plus `0 1px 2px rgb(0 0 0 / .18)` so the pill also lifts on the field.

## What I'd change first

1. **The mark step (item 1).** It lets color appear at small sizes across every screen, which is what makes a brand feel present without more gradient.
2. **Weight 500 on names, and the 22 step (item 2).** It gives every row and card a clear first read, and fills the gap between 18 and 36.
