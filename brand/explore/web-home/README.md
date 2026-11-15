# The website

The site's pages and the tools that check them. Ben asked for the app's lean way of working on the site too ([08:31](../../../product/words.md#2026-11-15-the-hero-from-the-reference-four-finger-hands-stop-motion-sprites-and-a-lean-site-workflow)).

| Folder | What it holds |
|---|---|
| `hero/` | The home page's first screen: the wall of photos, the field over it, the header, the open. `check.mjs` checks it on 11 screens. |
| `boards/` | Variants of a section side by side, for Ben to pick from. `render.mjs <board>` draws one. |
| `photos/wall/` | The wall's open-licensed photos and their credits. |

## How a change is made

1. Check only what you changed. The hero: `node brand/explore/web-home/hero/check.mjs`. One board: `node brand/explore/web-home/boards/render.mjs brand/explore/web-home/boards/<board>/`. A push does the same in CI: `web-boards.yml` redraws only the boards and pages its files touched.
2. Record nothing by default. Clips and side-by-side galleries are made only on request: `RECORD=1` on the command, or a manual run of `web-boards.yml` with "record" on.
3. Give mechanical edits to a Sonnet helper with the exact change: a string, a token swapped across pages, a list regenerated. Layout, motion and anything Ben will judge stay with the main session.
4. When a check or a test catches a bug, add a check that would have caught it, failing first: in `hero/check.mjs` for the site, or in `.agents/checks/` for anything a script can find across the repo. A script error on any screen already fails the hero check.
5. Tell Ben when something merges to main, not before.

Every string on a page passes `python3 -I .agents/skills/writing/scripts/lint.py --surface product <file>` and `node scripts/copy-lint.mjs`.

The logo uses the transparent paired-tag mark in `brand/mark.svg`, before the wordmark. Hand concepts and their opening animation have been retired.
