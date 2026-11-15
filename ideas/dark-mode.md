# Dark mode

Raised by Ben, round 7: "plan dark mode for later and research how to create dark mode using expert ui ux skills like emils or like apples design constitution guidance and use rdd. for quantifying the marks a dark mode needs to hit. also light vs dark should be exclusively color changes." ([words](../product/words.md#2026-11-15-round-7-picks)). The brand constitution already says it comes later.

**Waits on:** the brand being ratified in light, and the main screens existing.

## What it is

The same app on a dark page. Only colors change: no layout, size, weight or motion differs between the two.

## What already exists

- [brand/tokens.css](../brand/tokens.css) has a dark block that flips the page, the surfaces and the ink, and keeps black text on every fill. It is a proposal nobody has looked at on a screen.
- The app's copy of the brand values already carries it as `colorDark` ([tokens.generated.ts](../app/src/ui/tokens.generated.ts)), and no part reads a color any other way, so switching is one place.
- Expo sets this with `userInterfaceStyle` in the app config and reads it with `useColorScheme` ([Expo color themes](https://docs.expo.dev/develop/user-interface/color-themes.md), read 2026-11-15).

## First step

Research the marks a dark mode has to hit, from Apple's guidance and Emil's skills: contrast for each text and fill pair, how the gradient and the state colors behave on a dark page, and how depth is shown without shadows. Then turn each mark into a script check on the dark values before any screen is drawn.
