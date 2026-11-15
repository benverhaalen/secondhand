# What does Ben want in the UI, read from what he praised and what he criticized?
Researched 2026-11-15 by Ben (Claude Code, thread "Roll the UI system out everywhere"). Feature: cross-cutting (UI and brand).

Ben, 02:49 ([words](../../../product/words.md#2026-11-15-what-he-wants-over-what-he-says)): "if some of what i say contradicts past things ui wise consider what i want not what i say. that should be a great principle. the evidence from what i praise vs not. and extrapolate that." He said the same at round 10: "make sure what i mean not what i say reaches everything" ([words](../../../product/words.md#2026-11-15-round-10-picks)). This note is the evidence that principle reads from. [ui-constitution Article 8](../../../product/ui-constitution.md#article-8-ben-directs-by-reacting-the-agent-proposes) says how to use it.

Marks: *observed* (his words, quoted in words.md), *inferred* (our reading of what he wants under them).

## The record

Every row is *observed*: his reaction, in his words or close to them, at the linked heading.

| When | On | Praised | Criticized |
|---|---|---|---|
| 11-14 [round 6](../../../product/words.md#2026-11-14-round-6-picks) | Corner tag, gradient place | The corner tag; "how color is a bigger part of the app" | A solid tag (wants it "gradient like or semi transparent" yet clearly visible); "i dont like the lines" |
| 11-15 [round 7](../../../product/words.md#2026-11-15-round-7-picks) | Gradient, notice card, layout | The sky-lime gradient "as a gradient pattern and feel rather than the exact colors"; continuity, the photo enlarging into the page | "the layout looks weird ... scattered info ... no clear separations or hierarchy" |
| 11-15 [round 8](../../../product/words.md#2026-11-15-round-8-picks) | Palette, the item in a feed | | The palette "lacking deeper colors"; "the spacing ... seems like slop. it needs to be super intentional" |
| 11-15 01:16 [sizes](../../../product/words.md#2026-11-15-standard-sizes-darker-dark-colors-deslop-skills-and-ban-all-emojis) | Dark render | | Fonts not used; dark colors not darker; "not really a standard width and height"; emojis |
| 11-15 [round 10](../../../product/words.md#2026-11-15-round-10-picks) | The receipt, composition | The receipt (B); "not doing too much" | Composition, footers, spacing; the eBay icon blending into the receipt |
| 11-15 01:58 [black](../../../product/words.md#2026-11-15-a-constitution-with-little-wiggle-room-the-heavy-black-the-black-outline-and-the-gray-box) | Round 10 mock | | Heavy black only on buttons; the gray box behind the Dunks "doesn't feel as separate" |
| 11-15 02:18 [dark mode](../../../product/words.md#2026-11-15-dark-mode-approved-the-size-system-everywhere-clickability-money-and-countdowns-color-blind-checks) | Today, light and dark | "i like that dark mode a lot"; "the spacing i like"; the principles "look pretty damn good" | The light Dunks card not standing out; the Sold chip on the photo; Depop against the gradient; the title's spacing; a notice with an X and no action; card sizes and corners that differ |
| 11-15 02:46 [v3](../../../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready) | Today v3 | "the ui overall design in the middle of the last two" | The light shadow "looks a little weird"; fonts "a bit lighter"; the money "too blank"; the countdown "too close to the corner"; the top gradient too invasive |
| 11-15 02:59 [colors](../../../product/words.md#2026-11-15-color-blindness-weighed-lightly) | Color blind checks | | "dont weight to colorblindness too much": a word or an icon carries state, and his eye is one input, not the gate |

## What he wants under it

Each line is *inferred* from two or more rows above.

1. **Separation by tone, not by lines or shadows.** Praised: dark mode, where a lighter surface and a faint edge separate the card. Criticized: lines, the gray box that didn't separate, the light shadow. A thing stands apart by its surface being lighter or tinted against the page, with at most a hairline.
2. **Every size and gap is chosen, and the same for the same kind.** Praised: the spacing once it was fixed. Criticized: scattered info, slop spacing, sizes that differ, the cramped corner, the stacked titles. When a note names one gap, check every gap of that kind.
3. **Color carries character and meaning, softly.** Praised: color as a bigger part of the app, the sky-lime feel, soft tags. Criticized: clashes (Depop on the gradient), brown in dark, an invasive wash. More color is welcome when it is soft and means something; loud or muddy color is not.
4. **Understood at a glance with the fewest words, and never blank.** Praised: "not doing too much". Criticized: a bare number nobody can read ("too blank"), a notice whose action isn't shown. The fix for "too blank" is one label, not a sentence.
5. **Presence without heaviness.** Criticized: fonts too light, and also heavy black used only on buttons. He reaches for middle grounds; when he names two ends, build the middle and show it.
6. **Familiar, and pressable things look pressable.** Criticized: the title spacing ("should feel familiar"), the X on a notice that needs an action. Borrow the pattern people already know.
7. **His named fix is an example of the effect he wants.** "Gradient like or semi transparent", "earned this week", "make it green not brown" each name one way to reach a want (softness, a readable number, no brown for a color blind eye). Reach the want; the literal fix is one candidate.

## How it is kept

- Add a row when Ben reacts to a UI render, with the heading link, in the same commit as the words.md quote.
- When a reading above is contradicted by a new reaction, change the reading and say which row changed it.

## Limits

- The rows are a selection by the agent that wrote this note; words.md holds the full record.
- A reading is a guess until Ben reacts to a screen built on it.
