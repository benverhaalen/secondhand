# Round 5 showcases: lineage

Made 2026-11-14 with Codex image generation on Ben's subscription (`codex exec --ephemeral -s workspace-write -C <folder> "<prompt>" -i <file> ...`, no model flag, default model). One call per image, run in parallel. Images were not cropped, resized or post-processed. None was regenerated: each one was inspected at full size and none was unreadable, stretched, showing hands, showing a device frame where one was not asked for, or missing the field.

Prompt for every image except `default.png`: `Use your built-in image generation tool. Make one <landscape|portrait> image, <size> pixels.`, then the shared card from [../inputs/prompts.md](../inputs/prompts.md), then that image's quoted prompt from the same file, then `Save the image as PNG in this folder as <name>. Reply with the file path only.` `default.png` got the first line, its own prompt and the save line only.

Reference images (attached, not committed; originals in Ben's `~/Downloads/inspiration photos`):
- R1 = `design/ref-12.jpg` (Exalt dashboard)
- R2 = `some more references/jpg(12)` (Docket)
- R3 = `some more references/jpg(17)` (Sana automations)

| Image | Size | Attached | Prompt | Regenerated |
|---|---|---|---|---|
| style-tile.png | 1536x1024 | R1, R2, swatch.png, type.png | prompts.md image 1 | no |
| element-collage.png | 1536x1024 | R1, R3, swatch.png, type.png | prompts.md image 2 | no |
| usage-app.png | 1024x1536 | R1, swatch.png, type.png, true-today@2x.png | prompts.md image 3 | no |
| usage-post.png | 1024x1536 | R1, R2, swatch.png, type.png | prompts.md image 4 | no |
| usage-web.png | 1536x1024 | R1, R3, swatch.png, type.png | prompts.md image 5 | no |
| default.png | 1536x1024 | none | prompts.md image 6, no shared card | no |

`swatch.png`, `type.png` and `true-today@2x.png` are in [../inputs/](../inputs/).

Run notes: a first launch failed before any call reached Codex (a shell loop split the multi-line prompts), and a second failed for the five attached images because `-i` takes every following argument, so the prompt was read as an image path; the prompt now goes before the `-i` flags. `default.png` is from the second launch; the other five are from the third.

Logo chips, marketplace marks and all prices and names in these images are generated, not real assets or data.
