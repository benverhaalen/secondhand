# Camera feed photos: lineage

Stand-ins for the live camera view under the camera mock (`../round-2/mock/camera.html`). Generated, not real items; never show them as a real listing.

- Plan: `features/capture/design/feed.plan.json`, run once on 2026-11-15, 03:34 to 03:37 UTC, exit 0
- Model: `gpt-6-astra` through the Codex CLI (the runner's default; the plan sets none)
- Input to every job: `assets/demo-items/carhartt-jacket.jpg`, for the jacket itself
- PNGs converted to JPEG at quality 85 with `sips`; 1170 by 2532 kept

| Job | Result | File |
|---|---|---|
| feed-front | succeeded | `feed-front.jpg` |
| feed-back | succeeded | `feed-back.jpg` |
| feed-tag | succeeded | `feed-tag.jpg` |

Runner summary: `3 of 3 done. Most at once: 2 of 2. Load at its peak: 4.8 on 8 cores (new calls slow above 5.6). These calls at their peak: 63% of one core, 0.4 GB. Swapping at its peak: 0 MB a second. Slowed on 0 ticks.`

Last line, verbatim:

```
Call times: node spec/log.mjs /Users/benverhaalen/secondhand-runs/camera-feed/logs/job.image-s_mwha5yow.jsonl
```
