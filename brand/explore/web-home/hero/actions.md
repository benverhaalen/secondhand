# The first screen: every action and what answers it

Written before the build, as Ben asked (10:23: "before hand really define every possible action that could be done and what the resulting ui response could be and why"). Each row is held by `hero/check.mjs` where a script can hold it; the rest are judged against the sources named in the why. Timings and curves are the app's tokens (`--t-feedback` 150 ms, `--t-select` 200 ms, `--ease-out`), so the site moves like the app.

Sources: the [Appllama app design skill](../../../../.agents/vendor/appllama/appllama-app-design-skill/SKILL.md) (motion laws, anti-slop laws, state cycles), [Emil's emil-design-eng and break-ui](../../../../.agents/vendor/emil/), the [UI constitution](../../../../product/ui-constitution.md), [web.md](../../../../product/constitutions/web.md) and the [ledger](../../../ledger.md).

## What the screen is for

One sentence and one action. A stranger learns what secondhand is from the line, then either presses "See how it works" or scrolls; both land on section 2. Nothing else on the screen competes with that.

## Actions

| Action | Target | Response | Timing | Why |
|---|---|---|---|---|
| Open the site, first time this session | the page | The wordmark appears alone in the middle; the two hands step in beside it in four held frames; the mark settles into the header and the page comes up under it | 200 ms word, 400 ms hands after 200, 560 ms settle | A rare, first-time moment is the one place delight is allowed (Appllama, frequency gate). Stop motion, not smooth (Ben, 08:31; L58) |
| Open it again, or with Reduce Motion | the page | No open; the page is there at once | 0 | A repeat visit is not a first-time moment. Reduce Motion drops spatial motion |
| Click or press a key during the open | the open | It finishes at once and settles | 560 ms settle | Never make a person wait for an animation (Emil, never block) |
| No JavaScript | the page | The line, the button and the logos on the plain page; no wall and no open | none | The open must never cover the page when the script that removes it doesn't run |
| Photos still loading | each tile | The tile is the surface color, then the photo fades in | 1.2 s fade | Nothing moves or resizes when an image arrives (E30) |
| A photo fails | that tile | It stays the surface color; no broken-image mark | none | A broken icon on the first screen reads as a broken product |
| Scroll down | the wall and the line | The wall speeds up, opens out and fades; the line rises and fades | follows the scroll | Spatial continuity: the screen leaves as you leave it |
| Scroll down | the header | The header stays; a fade from the page color comes in behind it so text never runs under the pages pill | 200 ms in, 200 ms out | Ben, 10:23: "the fade at the top of the screen should only come in when you scroll". Appllama law 8: content under the top keeps a treatment |
| Back at the top | the header | The fade goes; the wall shows to the top edge | 200 ms | At rest the page has no gradient (L56) |
| The line on a phone | the line | Three lines, one phrase each, at 36; under 360 it breaks after "Your" and never inside "second hand," | none | A break inside a phrase reads as broken (the 10:23 render) |
| Hover a pill or a page link (mouse) | the pill | The field fills it as a circle from where the pointer came in; the label turns to the ink on the field. Leaving drains it toward where the pointer left | 240 ms in, 160 ms out | L57. Exits faster than entrances (Appllama, Emil) |
| Press a pill or a page link | the pill | Scales to .97 on press-in, back on release | 150 ms | The app's press (Appllama: press feedback on press-in, 100 to 150 ms, scale .97) |
| Hover the mark in the header | the right hand | Waves twice in three held poses | 480 ms, twice | L58. The only delight on the screen, and only when asked for |
| Click the mark | the page | Back to the top | smooth, or a jump with Reduce Motion | The mark is home, as everywhere on the web |
| Click "See how it works" | the page | Glides to section 2, its heading clear of the header | smooth, or a jump with Reduce Motion | The button's promise is kept on the same page, no load |
| Click a page link | that page | Opens it. How it works scrolls to section 2; the others open their page once it exists | none | A link that goes nowhere is a defect; until a page exists its link says so in the mock's notes |
| Click Sign in | sign-in | Opens web sign-in once it exists | none | Gray, not black: one black pill per view (C4, L50) |
| Tab through | each control in reading order | Mark, the four pages, Sign in, See how it works. Each shows the focus ring | at once | Keyboard users get the same order the eye takes |
| Narrow screen: press the menu button | the menu | A sheet under the header with the pages and Sign in; the button turns to a close mark | 200 ms | The pages pill doesn't fit under 900 |
| Close the menu: button, Escape or a link | the menu | Closes; focus goes back to the button | 200 ms | Escape and focus return are what a keyboard user expects |
| Touch | pills | No hover fill; the press scale only | 150 ms | Hover doesn't exist on touch |
| Rotate or resize | the line | The line refits; if "secondhand" doesn't fit, the line drops to 36 | at once | Nothing is cut off on any width (E29) |
| The store logos | none | Not controls: no hover and no press | none | They say where it lists, they don't go anywhere. A logo that looks pressable and isn't is a lie |

## States the screen draws

At rest, the open, scrolled (header fade), the menu open, hover, press, focus, Reduce Motion, no JavaScript, photos loading, a photo failed, a short landscape phone, a 320 px phone. Each is rendered or measured by `hero/check.mjs`.
