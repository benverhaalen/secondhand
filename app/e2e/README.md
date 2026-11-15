# app/e2e: checking a screen without a person

Two commands, run from the repo root. Both export the web build when the source is newer than it (about 5 seconds), serve it, and open each screen in Chromium at 390 x 844. Run `cd app && npm ci` once first.

| Command | What it does | Exit |
|---|---|---|
| `node scripts/app-check.mjs [route ...] [--sheet] [--json]` | The brand checks on the real render of each route, light and dark, each screenful of a screen that scrolls. Writes `features/app/renders/<slug>.png`, `<slug>-dark.png` (2x) and `<slug>.json` (`{ route, screen, states, status, findings }`, read by [app-gallery](../../scripts/app-gallery.mjs)). `--sheet` also saves `contact.png`, every screen side by side. No route means every route, and then `features/app/gallery.html` is rewritten. | 1 on any error |
| `node --test "app/e2e/*.test.mjs"` | The behavior tests. Node 22 does not take a folder here, so keep the quotes and the glob. | 1 on any failure |

Name a route as its file does or as the path you visit: `(tabs)/sell`, `sell`, `item/42`. A route with a `[param]` is skipped in a full run; name a real path for it. The screen names itself for the gallery: `dataSet={{ screen: 'today', state: 'empty' }}` on its root view becomes `data-screen` and `data-state`.

## A behavior test

Copy [today.test.mjs](today.test.mjs), the fullest example, to `<page>.test.mjs`. It reads `app/behavior/<page>.json` through `behavior()`, opens the screen with `start().open(route, { api })`, and answers the app's own requests with fixed data per state, so every state can be reached. Tests read the event log, not pixels:

- Each control in the table is `{ "id", "control", "on_tap", "goes"? }`, the one shape `picks.mjs` P5 checks: `control` is what a person sees, `on_tap` what pressing it does. The id is the part's `testID`, which React Native for web writes as `data-testid` and Maestro finds with `tapOn: { id }`.
- A pressed part pushes `{ type: 'tap', id }` to `globalThis.__events` on web; a screen pushes its own events there too. `screen.saw({ ... })` waits for one.
- `controlTests(test, table, open)` writes one test per control: pressing it logs the tap and goes where `goes` says.

The tests are written from the table before the behavior exists, and fail until it does.

## On a phone

[maestro/](maestro/) holds one flow per screen, the same states as the web test. They run on Ben's Mac with a simulator or a phone, not in the cloud: start the app with `npx expo start`, then `maestro test app/e2e/maestro/index.yaml`. A development build takes `-e APP_ID=<bundle id> -e URL=secondhand://`.

- A test that taps everything and asserts no unlisted tap counts only taps whose `screen` is the page's own path: once Back or a link leaves the page, later taps belong to another table.

## A demo video

`node scripts/app-demo.mjs <flow> [--dark] [--captions] [--frame] [--out file]` records a flow as a short clip, the kind a launch post on X shows: the web build at 390 x 844 driven by the demo worlds, no phone. It writes `features/app/demos/<flow>.mp4` (H.264, 2x; the raw webm when ffmpeg is missing) and `<flow>.png`, the last frame, for a poster. `--dark` and `--frame` add `-dark` and `-framed` to the name.

A flow is data: [demos/](demos/)`<flow>.json`, a list of steps, each one key. A soft dot shows where each tap lands, and a tap is followed by 600 ms so a viewer can follow it.

| Step | Does |
|---|---|
| `{ "go": "/?world=clearing" }` | Opens a path. The first one starts the clip; a later one holds the last frame and fades into the new page |
| `{ "tap": "<testID>" }` | Scrolls to the part if the thumb could not reach it, shows the dot, presses it |
| `{ "type": ["<testID>", "text"] }` | Presses a field and types into it at a person's speed, then Enter |
| `{ "wait": 1200 }` | Holds, in ms, while the screen does something worth watching |
| `{ "caption": "Short words" }` | With `--captions`, a line in a band under the screen, never on the app. `""` clears it |

`--frame` puts the screen in a plain rounded outline on a neutral ground, 1080 x 1350, for an X post. The script prints each step's time, so a flow is tuned to 10 to 25 s by its waits. `node --test scripts/app-demo.test.mjs` checks every flow: the step schema, every testID it presses is in `app/src/`, and every path it opens is a page.

| Flow | Shows |
|---|---|
| `today` | Accepting an offer on the jacket, Undo, then countering instead |
| `new` | ＋ opens the camera; a still reads Carhartt and asks Same thing?; the lamp that could be two things, and the maker's mark that stops the quick sale |
| `sell` | Sell filtered to Needs you and Live, then ＋, What's it worth, three stills, and the jacket's value |

## Why Playwright, not Stagehand

Ben asked at 04:11 whether Stagehand beats Playwright. For these tests it does not: they check our own screens, so every step must be exact, repeatable and free, and a model choosing what to click would make a pass mean less and cost a call per step. Stagehand runs on Playwright and fits sites we do not control, where the page changes under us; that is the harness, which uses browser-use with cached replays the same way ([ai-harness-from-repos](../../research/cross-cutting/ben/ai-harness-from-repos.md)). *Agent decision.*
