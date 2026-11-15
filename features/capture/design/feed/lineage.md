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

## feed-turn, added for the camera's second frame

The found pop sits at 156 from the top. In all three photos above, something is there: the hanger and hand (front), the hand and collar (back), a sleeve (tag). The pop belongs to the moment just after the first photo, so one more photo was made with the jacket partway turned and the top quarter plain.

- Plan: `features/capture/design/feed-turn.plan.json` (the back job's words, with "partway through turning it" and the top quarter kept plain), run once on 2026-11-15, 03:51 to 03:53 UTC, exit 0, `gpt-6-astra`
- feed-turn: succeeded, `feed-turn.jpg`

Runner summary: `1 of 1 done. Most at once: 1 of 1. Load at its peak: 5.5 on 8 cores (new calls slow above 5.6). These calls at their peak: 65% of one core, 0.2 GB. Swapping at its peak: 1 MB a second. Slowed on 0 ticks.`

Last line, verbatim:

```
Call times: node spec/log.mjs /Users/benverhaalen/secondhand-runs/camera-feed-turn/logs/job.image-s_mwharuhc.jsonl
```
