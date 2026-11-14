# ui-factory scripts

Each runs alone and prints its usage with `--help`. Python scripts use the standard library only (run with `python3 -I`). Node scripts are plain Node (`node <script>`); the browser ones need Playwright in the project being checked and print the install command when it is missing. They always use Playwright's own bundled Chromium with a fresh temporary profile that is deleted after the run, never a personal Chrome profile.

| Script | Stage | What it does |
|---|---|---|
| `token_scan.mjs` | brand intake, whole-app | Candidate tokens from running pages (`--url`, `--viewport`) or source (`--source`), plus `guesses.md`, what the scan had to guess |
| `membership_check.py` | check | Raw colours, sizes, radii, spacing, durations and Tailwind arbitrary values in source that should be tokens; visible waivers |
| `sdk_controls.py` | project start, check | Framework support and install status of the Vercel UI SDK; interactive controls not from the SDK without a written reason, using `references/control-sources.md` |
| `geometry_a11y.mjs` | check | Overflow, offscreen, clipping, truncation, overlap, covered controls, small targets, axe-core with `wcag22aa`; a screenshot per URL and viewport; `--dump-text` for screen text |
| `transitions.mjs` | door check | Runs a transition table as click-through checks, or `--emit` a `@playwright/test` spec; `--example` prints the table form |
| `shot_pair.mjs` | compare | Built screen at the image's viewport beside the approved image (`pair.png`), plus a pixel diff when sizes match |
| `video_frames.py` | input | Frames from a video by interval or scene change, with timestamped names and contact sheets (ffmpeg) |
| `screen_strings.py` | check | On-screen strings from source or a page dump; `--list` for the "should this exist" pass, otherwise the writing skill's product-surface lint |

Shared helper: `lib/pw.mjs` (finds Playwright in the project, opens the fresh profile).
