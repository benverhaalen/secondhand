---
name: image-gen
description: Use in secondhand whenever an image is generated (direction images, brand showcases, demo items, studio relights for mockups). Runs the Codex CLI with Astra through run.mjs, one fresh call per image, and hands each call how it will be judged, not what the image must contain.
---

# image-gen

Ben's words this comes from: [Codex with Astra, the loop and how to judge](../../../product/words.md#2026-11-14-image-gen-through-codex-and-astra), [faster rounds](../../../product/words.md#2026-11-14-faster-image-rounds), [fresh agents, how references are used, a reference set](../../../product/words.md#2026-11-14-fresh-image-agents-how-references-are-used-and-a-reference-set).

1. **Tool.** The Codex CLI with Astra, on Ben's subscription, through the runner: `node .agents/skills/image-gen/run.mjs <plan.json> <out folder>`. If Astra isn't available where you run, stop and tell your human. Don't substitute another image tool.

2. **One image, one fresh call.** The runner starts each job as its own `codex exec --ephemeral` in an empty folder outside any repo, and fails a call that leaves more than one image. An option is another call that edits the base image. The critic is another call. Round 6 asked one call for a base and all of its options, so the options shared the first one's mistakes.

3. **A call gets its prompt and its images, nothing else.** The runner refuses a prompt that is too long, names a rule doc or a path, or attaches more images than a call takes (the limits are at the top of [run.mjs](run.mjs)).

   | Call | Gets | Never gets |
   |---|---|---|
   | Base | The job in one line. The decision and this option, a line each. The exact words and numbers. The fail lines for this board | A rule doc, the ledger, the brief, another option |
   | Option | The base image and the one thing that changes | |
   | Fix | The failed image and the failures for that image | The whole critique, earlier rounds |
   | Critic | The option images, the color sheet, the fail list | The brief, the prompts, who made what |

   Add a line or an image only after a critic fails a call for something it could not have known. Measured in round 7, before this rule: a generator call used 47,000 tokens (median of 80), with a prompt of 3,200 to 4,500 characters that sent it to three rule docs. The same job as a plan here is 900 characters ([example](../../../brand/explore/round-7/r10-dark-button.plan.json)).

4. **Say how each image is used.** Every input has `take`: the one thing to use from it. A person's finished design (Ben's references, a shipped app's screen) is `ref: true` and also needs `leave`. Take a principle: how soft the gradient is, how much room a row gets, how a tag sits on a photo. Leave the screen: its layout, its words, its logo. Ben: "you aren't recreating the ui."
   Anything exact comes from a script, not from a reference or the image model: logos, type samples, color swatches, labels, stitching.

5. **Hand it how it will be judged, not a picture.** A prompt holds the job the image does and for whom, and the list a critic will fail it on. Composition and content are the call's. The fail list is fixed before the first call, because a critic left open rewords its findings and never finishes. Two critique rounds at most.

6. **The plan.** File paths are relative to the plan.

   ```json
   { "max": 24, "load": 0.7, "ramp": 2,
     "jobs": [
       { "id": "A", "prompt": "...", "inputs": [{ "file": "inputs/colors.png", "take": "The color sheet. Match these colors." }] },
       { "id": "B", "after": ["A"], "prompt": "...",
         "inputs": [{ "job": "A", "take": "This screen. Edit it." },
                    { "file": "refs/grain.jpg", "ref": true, "take": "How coarse the grain is.", "leave": "Its colors and layout." }] },
       { "id": "critic", "role": "critic", "makes": "critique.json", "after": ["A", "B"], "prompt": "...",
         "inputs": [{ "job": "A", "take": "Option A." }, { "job": "B", "take": "Option B." }] }
     ] }
   ```

7. **Fast, without overloading the machine.**
   - Freeze the plan before the first call. A change mid-run means a restart; round 6 restarted twice.
   - Put every image in one plan. The runner starts `ramp` calls every 2 seconds up to `max` at once, and holds new calls while the one-minute load is above `load` of the cores.
   - Why a ramp: a call's CPU is spent as it starts, about 5 CPU-seconds in its first 8 seconds, and then it waits on the server (measured on one text-only call on Ben's M3, 8 cores). Round 7 started 28 in the same second, four times. Inferred from that one call: each burst filled all 8 cores for about 20 seconds.
   - Why 24: a call holds about 160 MB (the same one call), so 24 stay under 4 GB of the Mac's 16.
   - After a run, read its last line: most at once, peak load, Codex CPU and memory, times held back. Raise `max` when the load stayed under the limit and nothing was held. Seconds per call: `node spec/log.mjs <out>/logs/*.jsonl`.
   - Push each image when it is done, so the person can start looking.

8. **Keep the record.** A `lineage.md` beside the output: the plan, the run's last line, the call table, what still fails. Never say an image exists without the file.

9. **After the brand is ratified** (*agent proposal*, from Ben's ask; due when the [ledger](../../../brand/ledger.md)'s Open table is empty). Make `brand/reference/`: one image for each state and component in the constitution's States table, the buttons, the tag, the notice, the gradient card and dark mode, each as a do and a don't, with an `index.json` holding each file's `take` and `leave`. From then on a plan attaches from that folder in place of the downloaded references and in place of words, and a critic judges against it.

Retire when: Codex's own image loop judges as well as this without being told.
