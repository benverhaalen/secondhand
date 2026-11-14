---
name: image-gen
description: Use in secondhand whenever an image is generated (direction images, brand showcases, demo items, studio relights for mockups). Runs the Codex CLI with Astra, and hands it the loop to run and how to judge, not what the image must contain.
---

# image-gen

Ben, 20:58: "ensure for all image gen you are using the codex cli with astra and telling it the loop to run and how it should judge rather than exactly what should be in it." ([words](../../../product/words.md#2026-11-14-image-gen-through-codex-and-astra))

1. **Tool.** The Codex CLI with Astra, on Ben's subscription: `codex exec --ephemeral -s workspace-write -C <folder> "<brief>" -i <reference> ...`. If Astra isn't available where you run, stop and tell your human. Don't substitute another image tool.
2. **The brief is a loop, not a picture.** Give it:
   - the job the image does, and for whom (one line)
   - the inputs: reference files attached with `-i`, plus `brand/constitution.md` and `brand/tokens.css` for anything branded
   - the loop: how many candidates to make each round, how to critique them, what to change next round, and when to stop
   - how to judge: the tests a good result passes (the brand's codes, the screen's job, readable at phone size, nothing invented, no text it can't spell) and what counts as failing
   Leave composition, layout and content to it. Hard constraints are only the ones a judge would fail it on.
3. **Keep the record.** Save the brief, the rounds and the chosen image beside the output, with a `lineage.md` like `brand/explore/round-5/showcase/lineage.md`. Never say an image exists without the file.

Retire when: Codex's own image loop judges as well as this brief without being told.
