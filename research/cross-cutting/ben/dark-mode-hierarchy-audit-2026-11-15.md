# Dark mode, hierarchy and layout math: research and audit
Researched 2026-11-15 by Ben (Claude Code, thread "Critique the brand and design system"). Feature: brand (cross-cutting).

Method: RDD with IAE and looped seeded research, as Ben's `research` skill runs it (deep mode). Each reference has a job. Every claim is marked *observed* (I read it in the source or ran it), *asserted* (a source says it without showing it, or it is from memory) or *inferred* (my reasoning). Numbers marked *measured* come from my own script on the token values (OKLCH, WCAG 2 contrast and APCA 0.0.98G). Nothing in the repo was changed. Token changes are proposals for the brand thread.

Picture: [dark-mode-compare-2026-11-15.png](dark-mode-compare-2026-11-15.png) shows the same Today slice in light, in dark as `tokens.css` defines it now, and in dark derived by the rule below. The type in it is a stand-in system face.

## The questions and the decisions they feed

1. Should dark mode move from "later" into the build now? Feeds ledger row "Later: Dark mode".
2. How do we make a dark mode that isn't a black hole on OLED? Feeds the dark block in `tokens.css`.
3. How is each light color's dark partner found analytically, and does text have to turn white? Feeds the same block and the constitution's Art. 5 "Dark mode".
4. What actually makes visual hierarchy, and do color theory, the rule of thirds and the golden ratio help? Feeds Art. 6 and 7.

## Draft answer from memory, before searching

Build dark now, since every color already goes through tokens. Page at about #121212, not black. Text about 87% white. Derive colors in OKLCH by keeping the hue and setting lightness by role. Big light fills on dark become dark tinted fills with white text. Golden ratio and rule of thirds are mostly myth in UI.

**What changed:** the fills. I expected big pastel fills to need dark versions with white text. Radix and Material both show the opposite for hues like ours: they keep light solids with dark text in dark mode, and only dim them. So black text on color can stay, which answers Ben's worry. Two smaller changes: secondary text needs to be lighter in dark than WCAG suggests (APCA polarity), and the current dark block has three bugs I didn't expect.

## References and their jobs

| Reference | Job | What we take | Mark |
|---|---|---|---|
| Apple HIG, Dark Mode, Color, Accessibility, Layout (read 2026-11-15; Dark Mode change log Aug 2024) | The platform's rules | Base and elevated backgrounds; label levels; 4.5:1 minimum and "strive for 7:1"; soften white image backgrounds; respect the system setting | observed |
| Apple HIG system color table | How Apple derives dark partners | Hue kept; accents get slightly lighter in dark (blue 0,136,255 to 0,145,255); grays invert (gray6 242,242,247 to 28,28,30) | observed |
| Radix Colors source (`src/light.ts`, `src/dark.ts`) and docs | An inspectable 12-step system with dark partners for our exact hues | Step roles; sky, mint and lime step 9 is the same hex in light and dark and takes dark text | observed |
| Material Color Utilities source (`color_spec_2021.ts`) | A second, independent system computed from tone | Dark surface tone 6, containers 4 to 22; dark primary tone 80 with tone 20 text; on-surface tone 90 | observed |
| Material dark theme codelab (Google) | Why not pure white or saturated color on dark | #121212; 87, 60, 38% text; pure white and saturated colors "vibrate" | observed (via fetch) |
| APCA introduction (Myndex) | Contrast that knows polarity | Light text on dark scores differently from dark on light; WCAG 2 "fails most with dark colors" | observed |
| Lookup, "Designing a Dark Theme for OLED iPhones" (2019) | A real failure trace on OLED | Black smear while scrolling; they moved to gray level 5 | observed; the smear claim itself is asserted, no measurement |
| NN/g, F-pattern (2006, 2017) and layer-cake scanning (2019) | Evidence for hierarchy | Eyes land on headings and first words; make headings distinct "but not absurdly" so | observed (via fetch) |
| Amirshahi et al. 2014, Art & Perception | Evidence on the rule of thirds | Small effect in photos only | observed (via fetch) |
| Phillips, Norman and Beers 2010 | Evidence on the golden rectangle | Fechner's result has not replicated well (they cite Green 1995 and Höge 1997) | observed for their statement; asserted for the cited reviews |
| Tim Brown, "More Meaningful Typography" (2011) | The case for ratio scales | "Modular scales are a tool, they're not magic" | observed (via fetch) |

The distant-field seed was visionOS comfort guidance inside the HIG: "avoid displaying a bright object on a very dark or black background" (observed). It is written for immersive viewing, so it transfers only as a direction (inferred).

## 1. Move dark mode into the build? Yes, as tokens and a check now. Screens follow.

- iOS people "generally expect all apps and games to respect their preference". Apple says to avoid an app-only appearance setting, because people "may think your app is broken" if it ignores the system one (*observed*, HIG Dark Mode).
- The app already asks for it. `app/app.json` sets `"userInterfaceStyle": "automatic"`, but `layout.tsx` and `text.tsx` read only `color`, never `colorDark` (*observed*). On a phone set to dark, the system parts (keyboard, alerts, pickers, the status bar) turn dark while our screens stay white (*inferred*). Either build dark or set `"light"` until we do. A half state is the worst of the three.
- The dormant dark block already has three bugs (below). Every screen built light-only adds more places to fix later (*inferred*).
- Cost now is small. It is one token block, one switch in the `ui` parts, and one script that checks every text and fill pair in both modes (*inferred*).

Recommendation: move it from "Later" into the build at the token level now. Every new part reads the scheme from day one. Judge the look on real screens once Today and Sell exist. This changes the ledger's "Later" row, so it's Ben's call.

## 2. Dark mode, not black mode

**The page isn't pure black, and it isn't far from it.**
- Apple's own dark page is #000, with #1C1C1E for grouped cells and elevated surfaces (*observed*, HIG gray table). Material uses tone 6, about #131313 (*observed*, source). Radix gray 1 is #111111 (*observed*). In OKLCH lightness those are 0, .19 and .18 (*measured*).
- Pure black smears on OLED when you scroll: pixels turning on from fully off lag behind (*asserted*, Lookup 2019; it is a known OLED trait but they show no measurement).
- What makes a dark mode feel like a hole is a flat ladder, not the page value. With one dark color for everything, nothing has depth, and bright things float with no ground (*inferred* from Apple's base and elevated sets and Material's overlays).

**The rule: depth is lighter, not shadowed.** In dark, a raised thing is lighter than what it sits on. Apple's base colors are "dimmer, making background interfaces appear to recede", and the elevated ones "brighter, making foreground interfaces appear to advance" (*observed*). Material raises surfaces from tone 4 to 22 (*observed*). Shadows don't read on a dark page (*inferred*), so our Art. 9 "hairline or one soft shadow" becomes "a lighter surface plus a hairline" in dark.

**Text isn't pure white.** Material says pure white "would visually vibrate against our dark backgrounds" and sets high-emphasis text at 87% (*observed*, codelab). Radix gray 12 is #EEEEEE, Material on-surface is tone 90 (*observed*). Claims that white on black blurs for people with astigmatism are common but I found no measured source. Lookup asserts it, and the APCA author says the evidence "isn't significant scientific consensus that goes much beyond user preference" (*observed* that they say so).

**Photos.** Apple: "If you display a content image that includes a white background, consider slightly darkening the image" (*observed*). Our item photos are on white sheets and pale floors (Art. 8), so in dark they would be the brightest things on screen (*inferred*). Dim photos to 92% brightness in dark.

## 3. Finding each dark partner analytically

Two independent systems, Radix and Material, converge on one rule. Each color has a role, the role fixes its lightness in each mode, and the hue stays (*observed* in both sources; the convergence is *inferred*). Applied to our tokens, in OKLCH, hue kept, chroma kept unless the gamut clips it:

| Role (what it's for) | Light now | Dark rule | Where the rule comes from |
|---|---|---|---|
| Page | white | L .185, C .006 at sky's hue | Radix gray 1 .178; Material tone 6 .187 |
| Raised surface (card) | white with hairline | L .225 | Apple #1C1C1E .227; Radix gray 2 .213 |
| Sheet, popover | white | L .265 | Apple tertiary #2C2C2E .294 |
| Gray control, skeleton | #EFF1F2 | L .30 | Apple tertiary .294 |
| Ink | #0A0A0A | L .95 | Radix gray 12 .949; Material tone 90 |
| Secondary ink | black 65% | L .82, opaque | Matched by APCA, see below |
| Fill (state, category, field) | L .88 (lime .93) | L .82 (lime .86), black text kept | Material dark primary tone 80 = L .83 with dark text; Radix sky, mint, lime 9 keep dark text |
| Tint (notice, failed) | L .955 | L .28, C .045 | Radix sky 3 dark .27; Material container tone 30 |
| Mark (small icons and dots on the page) | L .58 proposed | L .78, C .12 | Radix step 11 dark .79; Apple accents lighten |
| Brick (failed, destructive) | #C52B17 | same | White on it 5.6:1; on the dark page 3.4:1 for icons |

**Does text turn white? Only on the page.** On every fill it stays black, in both modes.
- Radix: "Sky, Mint, Lime, Yellow, and Amber are designed for dark foreground text" on steps 9 and 10, and sky 9, mint 9 and lime 9 are the same hex in light and dark (*observed*). Those are our hues at nearly our lightness: Radix sky 9 is L .86, ours is .88 (*measured*).
- Material's dark primary is a light tone (80) carrying dark text (tone 20) (*observed*).
- So the constitution's "black text on color in both modes" (A5) is right. What's missing is the dimming: at L .88 our fills are 12.6 to 15.4:1 against the dark page, the brightest things on screen. At L .82 they are 10.4 to 12.4:1 and still carry black text at 11.0 to 13.2:1 (*measured*). Apple: "In dark environments, colors appear bright and saturated" (*observed*), so the step down is in the right direction.

**Secondary text needs more than WCAG says.** WCAG 2 ignores polarity. In light, our secondary text scores APCA Lc 81. The current dark value (white at 65%) scores Lc 55, though WCAG rates it 7:1+ (*measured*). Dark secondary at L .82 (#C0C5C7) scores Lc 70. That keeps the gap between primary and secondary about the same as in light (96 to 70 in dark, 106 to 81 in light) (*measured*). The APCA introduction says WCAG 2 "fails most with dark colors" (*observed*).

**Marks on a fill use the light mark; marks on the page use the dark mark.** A fill stays light in both modes, so whatever sits on it keeps its light-mode partner (*inferred*; it is the same reason black text stays).

### Proposed dark block (for the brand thread)

```css
:root[data-theme="dark"] {
  color-scheme: dark;
  --page: #101315;  --surface: #191C1E;  --sheet: #212628;          /* new: --surface, --sheet */
  --gray: #2A2F31;  --gray-press: #33393C;
  --ink: #ECEFF1;   --ink-2: #C0C5C7;    --ink-disabled: #606466;   /* opaque, not alpha */
  --rule: rgb(255 255 255 / .14);  --scrim: rgb(0 0 0 / .6);
  /* fills: L .82 (lime .86), hue and chroma kept, black text kept */
  --lilac: #CABBEA; --sky: #92CEEA; --aqua: #7DD6D5; --mint: #8ED6B8;
  --lime: #D4D978;  --marigold: #E1BF84; --peach: #EAB897; --pink: #EAB3BF;
  /* tints: L .28, C .045 */
  --lilac-tint: #2C243C; --sky-tint: #0C2D3B; --aqua-tint: #043030; --mint-tint: #0F3024;
  --lime-tint: #2A2B0F;  --marigold-tint: #34260C; --peach-tint: #3A2312; --pink-tint: #3B1F26;
  --brick-tint: #3E1F19;
  /* the act: light pill on the page, black pill on any fill (new tokens --act, --act-ink) */
  --act: #ECEFF1; --act-ink: #0A0A0A; --ink-press: #D5D9DB;
  --pill-glow: none;
  --photo-dim: brightness(.92);   /* new */
}
```

Measured on this block: ink on page 16.1:1 (Lc 96); secondary 10.7:1 (Lc 70); black on fills 11.0 to 13.2:1; ink on dark tints 12.4 to 12.9:1; dark marks on the page 8.8 to 9.8:1; surface against page 1.09:1, so cards also keep their 14% hairline (1.49:1).

## 4. Visual hierarchy, color theory, the rule of thirds and the golden ratio

**What has evidence.**
- People scan headings and first words. NN/g's layer-cake pattern is "fixations made mostly on the page's headings and subheadings". The F-pattern is "the default pattern when there are no strong cues" (*observed*, eye tracking, 9 to 232 participants by study). So hierarchy works when the first words of each group are clearly the heading, which is the weight and size fix from the earlier critique (*inferred*).
- Distinct, not loud: "Be careful to not make the subheadings so absurdly brighter or larger than the body text" (*observed*, NN/g). That argues for 22 between 17 and 34, not a 2x jump (*inferred*).
- Apple: order by importance from the top leading corner; "people assume that aligned items are related", and indentation reads as subordinate; group with "negative space, container shapes, or separator lines" (*observed*, HIG Layout). This is why two left edges (card content and row content) read as two levels of hierarchy that don't exist (*inferred*).
- Contrast that matches polarity and size (WCAG, APCA), color never the only sign (HIG Accessibility), and lightness steps that are perceptually even (OKLCH) are measurable and tested (*observed* for the standards; the OKLCH point is *asserted*, from Ottosson's own description).

**What doesn't.**
- *Golden ratio.* The classic preference for golden rectangles has not replicated well; Phillips, Norman and Beers 2010 say so and cite Green 1995 and Höge 1997 (*observed* that they say it; the reviews themselves were not read). Markowsky's 1992 paper and Devlin's 2007 essay were not reachable. Tim Brown, who popularized ratio scales for type, calls them "a tool, they're not magic" (*observed*). Verdict: a ratio is useful as a constraint that keeps sizes few and far apart. Which ratio you pick is a taste choice, and no ratio makes a layout good on its own (*inferred*). For what it's worth, the top of our scale (13, 21, 34 or 36, 50) is already close to Fibonacci (13, 21, 34, 55). That isn't why it works.
- *Rule of thirds.* Amirshahi et al. 2014 found rule-of-thirds photos rated only slightly higher (0.59 against 0.54, d = .36), and concluded it "seems to play only a minor, if any, role" (*observed*, via fetch). No source I found tests thirds in interface layout. NN/g's data supports headings and reading order, not grid intersections (*observed* absence in what I read; a limited search, not proof none exists). It belongs only in item photo framing (Art. 8 already says "large and slightly off center"), not in screen layout (*inferred*).
- *Color harmony rules* (complementary, triadic, 60-30-10). I found no tested source for UI and did not search deeply. Treat them as starting points, not rules (*asserted*). What our system needs from color theory is perceptual: even lightness steps, enough contrast for each size and polarity, one meaning per hue, and hues far enough apart for color-blind people. That last point is why every state also carries an icon (*inferred*).

**So, for spacing:** a 4-point base is about crisp alignment on 2x and 3x screens and fewer choices, not beauty (*inferred*). The rhythm that matters is relational: inside tighter than between, by a clear ratio (8, 16, 40 from the earlier critique).

## 5. Audit of what we have now

### `brand/tokens.css` dark block (main, round 8 lock)

1. **Text on tints turns white on a near-white fill.** `--marigold-tint`, `--brick-tint` and the other tints aren't redefined in dark, but the notice card's text uses `--ink`, which flips to white. White on #FFEED2 is 1.14:1 (*measured*). It's invisible in the picture. Fix: dark tints at L .28 (block above).
2. **The black pill turns white on the field.** C4 uses `--ink`, which flips to white. On the field a white pill is 1.4:1 against sky and 1.2:1 against lime (*measured*). "Accept $38" loses its weight on the one card that matters. Fix: the act on any fill always uses `--on-color` (black). Add `--act` and `--act-ink` for the act on the page.
3. **The glow becomes a neon halo.** `--pill-glow` isn't redefined, so a sky and lime glow surrounds a white pill on a dark page (see picture). That is the Art. 13 tell in its strongest form. Fix: no glow in dark.
4. **One dark surface for everything.** Only `--page` and `--gray` exist, so cards, sheets and the page are the same dark (*observed*). That is the black-hole feeling. Fix: `--surface` and `--sheet`.
5. **Secondary text drops too far.** White at 65% scores Lc 55 against Lc 81 in light (*measured*). Fix: opaque #C0C5C7.
6. **Pure white ink** (#FFFFFF). Fix: #ECEFF1.
7. **Fills and the field are full brightness on dark**, 12.6 to 15.4:1 against the page (*measured*). Fix: L .82.
8. Fine as is: page lightness (.168) is close to Radix and Material and above Lookup's smear floor; scrim; focus ring (it reads page and ink, so it flips); the unread dot (4.8:1 on the dark page); brick.

### The app (`app/src/ui`, `app/app.json`)

9. `userInterfaceStyle: "automatic"` while no part reads `colorDark` (*observed*). See section 1.
10. Parts read `color.ink` everywhere. Nothing marks "this text is on a fill", so bug 2 would appear in code too (*inferred* from `layout.tsx` and `text.tsx`). Fix: a `Fill` part, or a `Txt` prop, that switches to `--on-color`.
11. Card depth is a border only (`layout.tsx`). In dark it needs `--surface` as well.

### The picks page (claude.ai/artifact/7a98Pc4VWDoarvKACEhvVP, live version as read 2026-11-15)

The live version still opens with "Round 8" and shows the round 8 options; I didn't find a round 9 version at that link (*observed*). It's a tool for picking, not product, so only what could mislead a pick matters:
12. It's light-only and uses Geist as the stand-in face, with no dark preview. Ben can't judge any gradient or fill in dark from it (*observed*).
13. Its fills are hard-coded per option (`--sky:#90D1EF` in A, and so on), not read from `tokens.css`, so a future dark option would drift from the tokens (*observed*).
14. Inside the specimens, state pills are 12 px and tab labels 10 px, under the 13 px floor in Art. 6, and the tab labels are under Apple's 11 pt minimum text size. Specimen pills are 32 px tall, under the 44 pt target (*observed* in the page CSS). This makes the specimens read denser and smaller than the real app would (*inferred*). It may be part of why Ben called the round 7 minimum "far too small".

### Light mode, against the research

The earlier critique stands ([design-critique-2026-11-15.md](design-critique-2026-11-15.md)). The research adds two things. NN/g's heading evidence backs the weight-and-size fix (item 2 there). Apple's alignment rule backs the one-edge fix (item 4 there).

## Checks to add (`.agents/checks/`), so this is enforced and not just written

- **Pair matrix.** For each mode, every text token on every ground it may sit on: WCAG 2 at least 4.5:1, and APCA at least Lc 75 for body and Lc 60 for secondary. It fails today on items 1, 2 and 5.
- **On-color.** Any text or act inside a fill uses `--on-color`, never `--ink`.
- **Ladder.** In dark, page < surface < sheet in lightness, with steps of at least .03 in OKLCH.
- **No glow in dark.** `--pill-glow` is `none` under `[data-theme="dark"]`.

## What I searched and couldn't reach

- Not reached: Material 2's dark theme spec page (JavaScript only; I used the codelab and the source), Markowsky 1992, Devlin 2007, Green 1995, Höge 1997, the Perception golden ratio paper, Twitter's design notes on its Dim and Lights out themes, any measured source on halation and astigmatism, and Emil Kowalski on dark mode (his vendored skills only cover `theme-color` and testing dark mode for invisible logos and borders).
- Not tested: any of this on an OLED phone. The proposed values are measured on paper and in a browser render, not on a device.
