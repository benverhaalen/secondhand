# How big is a button and its tap area, where does content sit in a rounded corner, and how do New and the camera move?
Researched 2026-11-15 by Ben (Claude Code, thread "Roll the UI system out everywhere"). Feature: cross-cutting (UI).

Ben, 02:46 ([words](../../../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)): buttons that hug, stay fixed or sit in between; a tap area that "needs to change based on the button and whats around it"; the countdown "a little too close to the corner. think of the shape and the extreme ends"; New "a bigger middle circle" that shows its options "in an animation" and "animates into the camera view"; something like "the id scanner things" for the camera; stacked cards that expand. The rules this note supports are in [frontend-standard](../../../product/frontend-standard.md) §3 and §5; the render is [today-v4-light-dark-new-camera.png](../../today/ben/today-v4-light-dark-new-camera.png).

Marks: *observed* (read at the source), *asserted* (a source claims it without method, or from memory), *inferred* (our reasoning), *measured* (a script or a headless render).

## 1. Where content sits in a rounded corner

A box with radius r and padding p. Content placed at inset x from both edges sits in the corner's square, and its distance to the arc along the diagonal is r − √2·(r − x) (*inferred*, plane geometry). The padding holds there only when that distance is at least p:

x ≥ r − (r − p) / √2

On a decision card (r 36, p 16) that is 21.9. Measured on the ink rather than the line box, the countdown's cap top sits at about y 20 (*measured*), so its right edge needs 24 (*measured*: at x 24, y 20 the distance to the arc is 16). That is why 16 from the right looked cramped while 16 from the left, next to a photo with radius 20 = 36 − 16, did not: concentric shapes keep the padding by construction (WWDC25 on concentric corners, in [size-system note](size-system-dark-rule-deslop-2026-11-15.md)).

## 2. Button sizes

| Kind | Size | Why |
|---|---|---|
| Pill (an action on a card) | 40 tall, hugs its label with 20 a side, at least 88 wide | A short label in a fixed-width pill reads as a gap; a long one wraps. Hugging keeps the label's weight honest, the floor keeps "Hold" from shrinking to a dot, and the copy limit (a verb and an object, 1 to 3 words, [copy.md](../../../product/copy.md)) is the ceiling, so a pill never grows past what a card's action band holds (*inferred*) |
| Full-width primary (the foot of a sheet or flow) | The content width (350) by 48 | One per screen, in thumb reach; a fixed width tells it apart from pills without a second style (*inferred*). Apple: "use style, not size, to distinguish the preferred choice" among peers (*observed*, HIG Buttons) |
| Icon button | A 40 circle; New is 56 | New is the one action that starts everything, so it is the largest target in the tab bar (*inferred*) |

The middle ground Ben asked about is a clamp: hug between a floor and a ceiling. The floor is a number; the ceiling is the copy rule, so it never needs a number in code.

## 3. Tap areas

- Apple: a control's hit region is at least 44 × 44 pt, and 28 × 28 at the very least (*observed*, HIG Buttons). Leave about 12 pt around bezeled controls and about 24 around unbezeled ones (*observed*, HIG Accessibility).
- What follows (*inferred*): the drawn size and the hit area are two things. A 40 pill gets 2 more above and below. Where a target sits alone, its hit area grows into the free space around it up to 44 on each axis. Where two targets are close, the gap between them is split down the middle, so no point belongs to two targets and a miss lands on the nearer one. [assist.md](../../../spec/features/assist.md) already asks for this split for pickers.
- In React Native this is `hitSlop` on `Pressable`, computed from the gap to each neighbour rather than set once (*inferred*).

## 4. Stacks

*Agent proposal, open for Ben.* Several decisions of one kind (five offers under your lowest, three items to ship today) stack: the soonest card on top, the next two as 8-pt slivers under it, and a count. A tap spreads the stack in place with a spring. Decisions of different kinds never stack, because a stack hides the deadline of every card but the top one, and Today's promise is that nothing is lost by ignoring the app ([spec](../../../spec/features/today.md)). References: the iOS notification stack groups by app and expands on tap, and Motion's examples include a notification stack built with a layout animation (*asserted*).

## 5. New, then the camera

- New is a 56 ink circle raised 14 above the tab bar. Pressed, the ＋ turns into × (45°), a scrim fades in, and its three choices (Sell this, What's it worth, Find this) rise from it one after another (*measured* in the render: each 220 × 56). Choosing Sell this opens the camera out of the button's circle, so the person sees where it came from (frontend-standard §3, origin).
- The camera reads the item with parts that each say something true (*inferred*): corner brackets frame what is being read; a soft line in the field colors sweeps while the work runs; points appear where features are found; each fact becomes a chip with a check as it resolves ("Carhartt", "Detroit jacket", "Brown duck canvas"); a fact not found yet is a blank chip ("Size"), the Leaving Blanks pattern in [assist.md](../../../spec/features/assist.md); a caption names the real comparison ("Matching against 214 sold jackets"). Nothing in it repeats once the work is done.
- Built with what the app has: `react-native-reanimated` 4.7.1 is in `app/` (*observed*). For a glow along the frame, `@shopify/react-native-skia` 2.14.0 and `react-native-animated-glow` 3.2.0 are MIT (*observed*, npm registry). Magic UI's Border Beam and Shine Border show the web version (*observed*, npm registry; the site was blocked).

## 6. What the top of Today shows

*Agent proposal, open for Ben* (ledger R40). The slot under the wordmark shows the first of these that is true, labeled, never $0.00:

1. Money earned this week: "Earned this week", the amount, "3 sold, after fees".
2. Nothing this week but earlier sales: the month's take-home, labeled by month.
3. Things live, nothing sold yet: what is live and its likely worth, as a range with its source a tap away.
4. A new person: the next setup step (connect a site, or take a photo of the first thing), with its one button.

## Limits

- No layout here was tried with a person.
- The stack and the top-slot order are proposals; Ben decides them.
- The 24 inset was measured for this font at 13 px; a different size moves the cap top, so the check measures the ink.
