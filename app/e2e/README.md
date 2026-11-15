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
