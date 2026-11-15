# What did Ben approve for dark mode and sizes, and what do the measured values rest on?
Researched 2026-11-15 by Ben (Claude Code, thread "Critique the design system and plan dark mode", renamed "Roll the UI system out everywhere"). Feature: cross-cutting (brand and UI).

Ben, 02:18, on the real-font render: "i like that dark mode a lot. whatever you did and learned ensure to update it in everything ... the spacing i like ... whatever rules you used and took out of my prompts get them into everything with ui" ([words](../../../product/words.md#2026-11-15-dark-mode-approved-the-size-system-everywhere-clickability-money-and-countdowns-color-blind-checks)). The work behind it is in three notes, in the order they were written:

1. [design-critique-2026-11-15.md](design-critique-2026-11-15.md): the first ranked critique of the system.
2. [dark-mode-hierarchy-audit-2026-11-15.md](dark-mode-hierarchy-audit-2026-11-15.md): dark mode, hierarchy, and what color theory, thirds and the golden ratio do and don't support.
3. [size-system-dark-rule-deslop-2026-11-15.md](size-system-dark-rule-deslop-2026-11-15.md): the mirror rule, one size per kind, the deslop repos and candidate checks S1 to S13.

Today redrawn from his 02:18 notes: [today-v3-light-dark.png](../../today/ben/today-v3-light-dark.png), and as a red-green color blind eye sees it, [today-v3-color-blind-sim.png](../../today/ben/today-v3-color-blind-sim.png). Content, alerts and clickability: [today-wants-alerts-and-clickability.md](../../today/ben/today-wants-alerts-and-clickability.md).

**Who lands what.** The brand identity thread lands the values below in `brand/tokens.css` and brand constitution Articles 4 to 10, with ledger rows (agreed between the threads 02:24). The brand system thread adds the checks to `scripts/brand-check.mjs`. The rules for clickability, countdowns, kind tags and color blindness are in [frontend-standard §5](../../../product/frontend-standard.md#5-audit-checklist). This note holds the evidence, not the values' home: once tokens.css has them, it is the source.

## The rules Ben approved, in one line each

- **Mirror rule.** Each surface keeps the contrast it has against the page in light, measured against the dark page. Hue kept, chroma .015 lower, text is the ink of its mode, the act is the ink color in both modes. *Measured*: white card on the light page 1.11:1, dark card on the dark page 1.10:1.
- **Raised is lighter, in both modes.** Light: white cards on a tinted page (#F1F3F5) with a soft shadow. Dark: #1A1D20 on #101315 with an edge and no shadow. The earlier light render put a white card on a white page, which is why it looked flat next to dark (Ben, 02:18).
- **No dark yellow.** Yellow and lime never fill a dark ground: it reads brown, and Ben is color blind. Small marks (state tags, dots) keep their light fills with black text in dark. The dark field is sky, mint and aqua.
- **Same kind, same size.** Fixed slots, one-line title and detail with truncation, so content never grows a box. *Measured* in both renders: decision cards 350 x 156, notices 350 x 56, tags 20 high.
- **Corners nest.** Card 36 = photo 20 + padding 16; pills and notices are capsules.
- **Two intervals.** 12 inside a card, 16 between cards, 32 between sections. (The first table said 40, which is not on the 4-pt scale.)

## What the values rest on

| Claim | Source | Mark |
|---|---|---|
| Raised surfaces are lighter in dark | Apple HIG Dark Mode, base and elevated colors; Material tones 4 to 22 | observed (note 2) |
| Saturated color glares on dark, so chroma drops | Hallmark's dark recipe (−.02 to −.04); Material codelab | observed (note 3) |
| Pure white text vibrates on dark | Material codelab; Radix gray 12 #EEEEEE | observed (note 2) |
| Darken white-background photos in dark | Apple HIG Dark Mode | observed (note 2) |
| Shared anatomy within a kind; concentric corners | WWDC25 "Get to know the new design system" | observed (note 3) |
| Uniformity across kinds is the root of slop | unslop-ui-skill, avoid-ai-design, Impeccable antipatterns | observed (note 3) |
| Golden ratio and rule of thirds don't predict preference | Phillips 2010 citing Green 1995 and Höge 1997; Amirshahi 2014, d = .36 | observed (note 2) |
| Red-green distances between state colors | Machado et al. 2009 matrices, our script | measured (today note §6) |
