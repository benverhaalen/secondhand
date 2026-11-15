# Camera, round two: composed in code over photos

Ben, 2026-11-15 03:24, on round two: "combine the brand system created with ai photo gens and layer it rather than telling the photo gen to actually generate the ui. you should piece them together yourself. generate an ai image to be a placeholder for camera feed." So the image model makes only the photo under the camera ([../feed/](../feed/lineage.md)), and the screen is HTML built from [brand/tokens.css](../../../../brand/tokens.css) and round 11's parts ([screens.css](../../../../brand/explore/round-11/mock/screens.css)).

Open [camera.html](../../../../brand/explore/camera-buy/camera/camera.html) in a browser (`?s=front`, `?s=back`, `?s=tag`; add `&low=80` for a saved lowest price). The source sits beside round 11's kit in `brand/explore/camera-buy/`, because the repo's check reads anything outside `brand/` as app code and these values are not locked. The type needs `fonts.local.css` beside it, which is not in git (the round 11 README says how).

| Render | Shows |
|---|---|
| [renders/cam-front.jpg](renders/cam-front.jpg) | Nothing done yet |
| [renders/cam-back.jpg](renders/cam-back.jpg) | The front done, and what the app read popping in |
| [renders/cam-tag.jpg](renders/cam-tag.jpg) | Two done |
| [renders/cam-back-lowest.jpg](renders/cam-back-lowest.jpg) | The variant with a saved lowest price |

What it follows: Ben's 03:17 notes (stages as empty circles that turn to checks, one centered instruction under them, a found fact with a check, the person presses the shutter) and [the round-one merge](../round-1/merge.md). Sizes are the ones the camera's motion preview uses, so the still and the motion share one set of values. The motion itself (how the pop comes and goes, the point cloud, haptics, voice) belongs to the motion preview, not this still. Every value not in tokens.css is one line at the top of [camera.css](../../../../brand/explore/camera-buy/camera/camera.css). *Agent proposal* until Ben picks.

Rendered at 390 by 844, device scale 3, with PP Neue Montreal 400 loaded (`document.fonts.check`); the camera uses no other face.

## What the checkers flag

`node scripts/brand-check.mjs brand/explore/camera-buy/camera/camera.html --medium app`: 25 errors, all from the motion preview's values, left as they are on purpose so there is one set:

| Rule | What | Why it stays |
|---|---|---|
| B6 | The instruction is white text over the photo | Its ground is the shade, as the motion preview draws it |
| B5 | The shade is a gradient written in the file | The shade under the camera has no token yet |
| B7 | Close and voice are white at 12% | The preview's value; no token |
| B17 | Stages and the found pop use a gap of 10 | The preview's value; not on the space scale |
| B20 | The last photo has a 14 corner | The preview's value; not on the radius scale |
| B8 | "The field fills 3 views" | The checker reads the full-screen camera as a field; the camera has no field |

`node scripts/copy-lint.mjs` on every string: clean.
