# What makes a design bold on purpose, and a signed-out site alive?
Researched 2026-11-15 by Ben (Claude Code agents, UI thread; a nine-agent workflow: four questions, each rechecked by a second agent that reopened every source, then one synthesis). Feature: cross-cutting.

Ben, 01:11: "making bold decisions with a purpose to create something that feels unique. rather than creating a generic ui. i think this is something else missing ... but bold moves need purpose too", and "on the website i want it to be moving. feel alive" ([words](../../../product/words.md#2026-11-15-bold-with-a-purpose-alive-and-levers-for-ideation)).

Every design line here is an *agent proposal*. What it changed is in [frontend-standard §2 and §3](../../../product/frontend-standard.md#2-build-the-loop).

**Tags.** *Observed*: the second agent reopened the page and it says so. *Asserted*: reported, not confirmed on the page. *Inferred*: our reasoning.

## What the sources say

| Claim | Source | Tag |
|---|---|---|
| A brand asset works when it is unique (it evokes only this brand) and famous. "Of these two, uniqueness is most important." Inconsistent use is what erodes it | [Romaniuk, Ehrenberg-Bass](https://marketingscience.info/brands-of-distinction) | observed |
| Among similar things, the one that differs is the one remembered. Emphasis needs restraint, or the emphasized things compete | [Laws of UX, von Restorff](https://lawsofux.com/von-restorff-effect/) | observed |
| People prefer designs that are both typical and novel, and the two pull against each other | [summary of Hekkert et al. 2003](https://www.jimdavies.org/summaries/HekkertSneldersVanwieringen2003.html) | observed on a summary; the paper was not opened, and it studied products, not screens |
| "Using your brand color too broadly can overwhelm your interface and dilute its impact." Express the brand with familiar components, keeping their size, place and behavior | [Apple HIG, Branding](https://developer.apple.com/design/human-interface-guidelines/branding) | observed |
| "Don't add motion for the sake of adding motion." Make motion optional, let people cancel it, and avoid it on things done often | [Apple HIG, Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | observed |
| Anything that moves on its own for more than five seconds beside other content needs a way to pause, stop or hide it, unless the movement is essential | [WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide) | observed |
| Stripe's Connect page played its product flow as an animation built in code, started when it came into view, and turned decorative animation off under reduced motion | [Stripe](https://stripe.com/en-ro/blog/connect-front-end-experience) | observed |
| "We could have used a static asset, but the animated version helps the user understand what this feature does" | [Emil Kowalski](https://emilkowal.ski/ui/you-dont-need-animations) | observed |
| Scroll effects help when they add information step by step. Most study participants were at least mildly disoriented when a page took over scrolling | [NN/g, scrolljacking](https://www.nngroup.com/articles/scrolljacking-101/) | observed |
| Reveal on scroll: sparingly, 100 to 400 ms, once only, and not on mobile | [NN/g, scroll fading](https://www.nngroup.com/articles/scroll-fading-101/) | observed |
| "Never transition: all." Animations are cancelable by user input | [Vercel guidelines](https://vercel.com/design/guidelines) | observed |
| People who made several designs before any feedback made better and more varied ones than people who refined one | [Dow et al. 2010](https://hci.stanford.edu/publications/2010/parallel-prototyping/ParallelPrototyping2010-submitted.pdf) | observed |
| A design shown alone gets higher ratings and less criticism than the same design shown among three | [Tohidi et al. 2006](https://www.microsoft.com/en-us/research/?p=151922) | observed |
| Designers shown an example tend to copy its features (design fixation) | Jansson and Smith 1991, by way of a later paper | asserted |
| Reanimated turns animation off by default when the phone's Reduce Motion is on. `ReduceMotion.Never` overrides that | [Reanimated docs](https://docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig/) | observed |

## A bold move, defined so a judge can fail it

All *inferred* from the rows above. No source gives the counts.

1. **Name it.** One sentence says the one way this departs from how apps of this kind do it (scale, crop, layout, type, color or motion), and what stays conventional.
2. **Purpose.** It names what it is for: what to look at first, the story, feedback, a change of state, or recognition. "It looked good" fails.
3. **Ownable.** With the wordmark covered, it still could only be secondhand, and it comes from what the product does.
4. **One.** One per view in the app. One per section on the site, and one signature motion per page.
5. **Repeated.** The same move comes back on every screen. A different bold move on each screen is noise.
6. **It never breaks** legibility, the size, place or behavior of a familiar control, meaning carried by more than color, Reduce Motion, or the photo coming first.

Our candidates for the owned move are the drifting gradient and how the item photo is treated. The gradient alone is weak on uniqueness, because a soft mesh behind a hero is what a model draws by default (*inferred*, from tasteskill's list of defaults, which we did not test).

## Levers for ideation

Fourteen were brainstormed: photo as hero, one thing, hands on it, alive, brand signature, first action, boldness of scale, new pattern, density, restraint, playfulness, trust and proof, storytelling, sound and touch. Seven were kept, in [frontend-standard §2](../../../product/frontend-standard.md#levers-for-the-steered-designs).

- **Boldness and innovation became one lever**, "one departure", because both chase novelty and a model told to "be bold" changes five things at once (*inferred*).
- **Each lever names a change in structure, not an adjective.** "Playful" and "trust" were dropped because a model answers an adjective with decoration (*inferred*).
- **Density and restraint were dropped** because the grid's density is already the person's to pinch (ledger L23).
- **Judge the designs side by side, after all are made.** Dow and Tohidi both support this, and the loop already does it.

## What makes the signed-out site alive

| Move | Its purpose | Where it backfires |
|---|---|---|
| The product's own flow as the hero, built in code: a photo becomes a listing on five sites | Story | A looping video nobody can pause, or a demo that differs from the app (*inferred*) |
| The gradient drifts, and the drift means something (one field changing into the next as an item moves from listed to sold) | Recognition | With no meaning it is decoration, and it needs a way to stop it (WCAG 2.2.2) |
| Progress tied to the page's own scroll, never changing its speed or direction | Story | Taking over the scroll disoriented most people in NN/g's study |
| Sections reveal once, in 100 to 400 ms, and not on a phone | What to look at first | Repeated or slow reveals hide content |
| Real numbers, fetched | Proof | Small or faked numbers (*inferred*) |
| The page answers the pointer, only where there is one, and stops when interrupted | Feedback | The sources are about app gestures; carrying it to the site is *inferred* |

## Checks

| Held by | Rule |
|---|---|
| A script, today ([picks.mjs](../../../.agents/checks/picks.mjs) M1 to M4) | Reduce Motion is never overridden. No `transition: all`. No scroll listeners. Every duration is a named motion with a reason, never a raw number |
| A script, once the site exists (not built) | A reduced-motion rule for every CSS animation ([stylelint-a11y](https://cdn.jsdelivr.net/npm/@double-great/stylelint-a11y@3.5.0/src/rules/media-prefers-reduced-motion/README.md)). Only transform and opacity animate ([stylelint-high-performance-animation](https://github.com/kristerkari/stylelint-high-performance-animation)). The hero is not a video file |
| The rendered page (not built) | Playwright with `reducedMotion: 'reduce'`, then no running animations. Every endless animation has a pause. Layout shift at 0.1 or less ([web.dev](https://web.dev/articles/cls)) |
| A judge | Whether the stated purpose is true. Whether it is ownable with the wordmark covered. Whether the photo still leads |

## Limits

- tasteskill was read, not tested. Its "one marquee per page" and its list of model defaults are its author's rules.
- The counts in the bold-move test are ours. No source sets them.
- Studio practice rests on one Pentagram case study. No user of ours has seen any of this.
- The stylelint plugins were read from their READMEs. Neither was run, and the second one's upkeep was not checked.
