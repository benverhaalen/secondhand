# Camera, round two: composed in code over photos

Ben, 2026-11-15 03:24, on round two: "combine the brand system created with ai photo gens and layer it rather than telling the photo gen to actually generate the ui. you should piece them together yourself. generate an ai image to be a placeholder for camera feed." So the image model makes only the photo under the camera ([../feed/](../feed/lineage.md)), and the screen is HTML built from [brand/tokens.css](../../../../brand/tokens.css) and round 11's parts ([screens.css](../../../../brand/explore/round-11/mock/screens.css)).

Open [camera.html](../../../../brand/explore/camera-buy/camera/camera.html) in a browser (`?s=front`, `?s=back`, `?s=tag`; add `&low=80` for a saved lowest price). The source sits beside round 11's kit in `brand/explore/camera-buy/`, because the repo's check reads anything outside `brand/` as app code and these values are not locked. The type needs `fonts.local.css` beside it, which is not in git (the round 11 README says how).

| Render | Stages done | Instruction | Photo |
|---|---|---|---|
| [renders/cam-front.jpg](renders/cam-front.jpg) | Kind | Lay it flat | The front, held up |
| [renders/cam-back.jpg](renders/cam-back.jpg) | Kind (Photos under way), "Carhartt" just read | Turn it over | The jacket partway turned |
| [renders/cam-tag.jpg](renders/cam-tag.jpg) | Kind, Photos | Closer on the tag | The collar lifted, tag showing |
| [renders/cam-back-lowest.jpg](renders/cam-back-lowest.jpg) | as cam-back | as cam-back, with "Lowest $80" | as cam-back |

## What it follows

- **Stages.** One circle per stage that appears for this jacket, from [section 4 of the attribute tree](../../../../research/capture/ben/item-attributes-by-site.md#4-the-decision-tree-from-the-first-photo-to-a-postable-listing): Kind, Photos, Label, Measure, Condition. Match, Category, Details and Size do not appear because the tag answers them, and Review comes after the camera. A stage is one circle, so the front and the back share the Photos circle.
- **Instructions.** Each is the tree's line for its stage ("Lay it flat", "Closer on the tag") or the capture spec's line for the view still missing ("Turn it over", [spec/features/capture.md](../../../../spec/features/capture.md)). Each names what to do next and is true to its photo.
- **The found pop** belongs to the moment just after the first photo. At 156 from the top it landed on the hand or the jacket in all three first photos, so a fourth photo was made with that band plain ([feed lineage](../feed/lineage.md)); the pop did not move.
- **Weight.** Text is 500 (`--w-text`), as Ben decided at 03:45.
- Ben's 03:17 notes and [the round-one merge](../round-1/merge.md). Motion (how the pop comes and goes, the point cloud, haptics, voice) belongs to the motion preview, not this still.

Rendered at 390 by 844, device scale 3, with PP Neue Montreal 500 loaded (`document.fonts` and `document.fonts.check`).

## Values that are not tokens, and why

All are at the top of [camera.css](../../../../brand/explore/camera-buy/camera/camera.css), one line each. They are the camera motion preview's sizes, kept so the still and the motion share one set: the top bar (54, 16, 44), close and voice at white 12%, stages of 22 with gaps of 10, the instruction at 112 with 24 insets and 24 line height, its text shadow, the pop at 156 (44 tall, a 28 mint circle, its shadow), the bottom row (36, 28), the 76 shutter with a 60 fill, the 48 thumbnail with a 14 corner, and the shade's stops. Colors inside them are mixed from `--ink`, `--surface`, `--sky` and `--mint`.

## Contrast, measured on the render

Each text's color against the darkest and the lightest pixel behind it, read from the same frame rendered with every text and icon hidden (text shadow not counted). Under 4.5:1 would fail; nothing does.

| Frame | Text | Against darkest | Against lightest |
|---|---|---|---|
| front | Lay it flat (white on the shade) | 12.39 | 8.55 |
| back | Turn it over | 12.37 | 8.55 |
| back | Carhartt (ink on white) | 14.28 | 19.80 |
| back, lowest | Lowest $80 | 19.80 | 19.80 |
| tag | Closer on the tag | 13.88 | 10.10 |
| all | 9:41 (white on the shade) | 19.0 | 18.1 |

## Judge pass

`node scripts/ui-rules.mjs judge app`, read against each frame by a reviewer who did not build it:

- **L2** (only black, white and gray, no color ground): front and tag have no color ground beyond the current stage's faint sky halo; back has the pop's mint. *Taste call*: a camera is the photo, and adding a color ground would be decoration.
- **Q1** (name the one departure): the found fact arrives as one word with a mint check over the live view. *Taste call* whether that is enough of a departure.
- Passed in every frame: U4 (stages differ by shape, not color), D3, B1 (the shade is the ground for the words and controls), B2 (the photo first), L32 (no Clofie), P8 (no tab bar, as fixed).

## What the checkers flag

`node scripts/brand-check.mjs brand/explore/camera-buy/camera/camera.html --medium app`: 29 errors, none changed:

| Rule | What | Why it stays |
|---|---|---|
| B13 | Text at weight 500 | The checker still expects 400; Ben decided 500 at 03:45 and tokens.css has `--w-text: 500`. The checker is behind |
| B6 | The instruction is white over the photo | Its ground is the shade, as the motion preview draws it |
| B5 | The shade is a gradient written in the file | No token for the camera's shade yet |
| B7 | Close and voice at white 12% | The preview's value |
| B17 | Gaps of 10 | The preview's value |
| B20 | The thumbnail's 14 corner | The preview's value |
| B8 | "The field fills 3 views" | The checker reads the full-screen camera as a field; the camera has no field |

`node scripts/copy-lint.mjs` on every string: clean.
