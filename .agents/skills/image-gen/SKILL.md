---
name: image-gen
description: Use in secondhand whenever an image is generated (direction images, brand showcases, demo items, studio relights for mockups). Runs the Codex CLI with Astra through run.mjs, one fresh call per image, and hands each call how it will be judged, not what the image must contain.
---

# image-gen

Ben's words this comes from: [Codex with Astra, the loop and how to judge](../../../product/words.md#2026-11-14-image-gen-through-codex-and-astra), [faster rounds](../../../product/words.md#2026-11-14-faster-image-rounds), [fresh agents, how references are used, a reference set](../../../product/words.md#2026-11-14-fresh-image-agents-how-references-are-used-and-a-reference-set).

0. **Never generate UI.** Screens are composed in code from the parts and the brand values; an image model makes only the content they hold (item photos, a camera feed placeholder, a studio relight), which is layered in (Ben, [03:24](../../../product/words.md#2026-11-15-compose-screens-from-the-brand-system-and-layer-ai-photos)). 0. **Skip it when code can show it.** If the components and tokens that already exist can build the screen or the option, build that in code and show it. Colors, gradients and motion are exact in code and drift in a generated image (Ben, [round 7](../../../product/words.md#2026-11-15-round-7-picks): "if all the components we already have could build it skip the image gen phase"). Generate an image for what does not exist yet.

1. **Tool.** The Codex CLI with Astra, on Ben's subscription, through the runner: `node .agents/skills/image-gen/run.mjs <plan.json> <out folder>`. If Astra isn't available where you run, stop and tell your human. Don't substitute another image tool.

2. **One image, one fresh call.** The runner starts each job as its own `codex exec --ephemeral`, in an empty folder outside any repo, under a Codex home that holds only the sign-in. A call so starts without the repo's rules and without the person's own Codex instructions, hooks and skills. The runner fails a call that leaves more than one image. To compare one decision, make every option as an edit of the same base image, each in its own call: two images made apart never match (the R10 redo's two jackets differ). The critic is another call. Round 6 asked one call for a base and all of its options, so the options shared the first one's mistakes.

3. **A call gets its prompt and its images, nothing else.** The runner refuses a prompt that is too long, names a rule doc or a path, or attaches more images than a call takes (the limits are at the top of [run.mjs](run.mjs)).

   | Call | Gets | Never gets |
   |---|---|---|
   | Base | The job in one line. The decision and this option, a line each. The exact words and numbers. The fail lines for this board | A rule doc, the ledger, the brief, another option |
   | Option | The base image and the one thing that changes | |
   | Persona design (round one) | What any design call gets, plus one person's line from [personas.md](../../../product/personas.md) | A second person, a lever, a layout |
   | Steered design | What an open design gets, plus one lever line from [frontend-standard §2](../../../product/frontend-standard.md#levers-for-the-later-rounds) | A second lever, a layout |
   | Fix | The failed image and the failures for that image | The whole critique, earlier rounds |
   | Critic | The option images, the color sheet, the fail list | The brief, the prompts, who made what |

   Add a line or an image only after a critic fails a call for something it could not have known. Measured: round 7's generator calls used 47,000 tokens (median of 80) and took 76 to 102 seconds, with prompts of 3,200 to 4,500 characters that sent each call to three rule docs. Under these rules the six calls of the [R10 redo](../../../brand/explore/round-7/r10-dark-button.plan.json) had prompts of 900 characters, used 18,000 to 32,000 tokens and took 48 to 56 seconds. The clean home alone took Codex's fixed cost per call from 9,030 tokens to 4,089.

4. **Say how each image is used.** Every input has `take`: the one thing to use from it. A person's finished design (Ben's references, a shipped app's screen) is `ref: true` and also needs `leave`. Take a principle: how soft the gradient is, how much room a row gets, how a tag sits on a photo. Leave the screen: its layout, its words, its logo. Ben: "you aren't recreating the ui."
   Anything exact comes from a script, not from a reference or the image model: logos, type samples, color swatches, labels, stitching.

5. **Hand it how it will be judged, not a picture.** A prompt holds the job the image does and for whom, and the list a critic will fail it on. Composition and content are the call's. The fail list is fixed before the first call, because a critic left open rewords its findings and never finishes. Two critique rounds at most.

6. **The plan.** File paths are relative to the plan.

   ```json
   { "max": 24, "load": 0.7, "ramp": 2, "swap": 10, "timeout": 600,
     "jobs": [
       { "id": "A", "prompt": "...", "inputs": [{ "file": "inputs/colors.png", "take": "The color sheet. Match these colors." }] },
       { "id": "B", "after": ["A"], "prompt": "...",
         "inputs": [{ "job": "A", "take": "This screen. Edit it." },
                    { "file": "refs/grain.jpg", "ref": true, "take": "How coarse the grain is.", "leave": "Its colors and layout." }] },
       { "id": "critic", "role": "critic", "makes": "critique.json", "after": ["A", "B"], "prompt": "...",
         "inputs": [{ "job": "A", "take": "Option A." }, { "job": "B", "take": "Option B." }] }
     ] }
   ```

   A fix round is a second plan: one job per failed image, whose inputs are that image and the color sheet, and whose prompt is the first prompt plus that image's failures.

7. **Fast, without overloading the machine.**
   - Freeze the plan before the first call. A change mid-run means a restart; round 6 restarted twice.
   - Put every image in one plan. The runner starts `ramp` calls every 2 seconds, up to `max` at once. While the one-minute load is above `load` of the cores, it starts one call every 10 seconds instead. While the machine swaps more than `swap` MB a second, it runs one call at a time. A call still running after `timeout` seconds is stopped with everything it started, and stopping the runner (Ctrl-C, or a kill from an agent's timeout) stops its calls too, so none is left running on its own.
   - Why: a call costs CPU as it starts, then waits on the server. Measured on Ben's M3 (8 cores): 24 one-line calls started in the same second took the load to 54, and each took 99 seconds instead of 8. Round 7 started 28 that way, four times. A running image call used 3% of one core or less.
   - Why 24: at their peak, 24 calls held 3.2 GB of the Mac's 16 (the same run).
   - After a run, read its last line: most at once, the load at its peak, what the calls used, and how often it slowed. If the load crossed the limit with nothing else running on the machine, lower `ramp`. Seconds per call: `node spec/log.mjs <out>/logs/*.jsonl`.
   - Why swap: the load of 66 to 89 that round 7's image run met was the Mac swapping, not its CPU. Measured on 2026-11-15: RAM full, swap at 10.7 of 12 GB, 4.4 GB swapped in within 5 minutes, and the CPU about half idle, with one image call running at under 11% of a core. On macOS, threads waiting on swap count toward the load, so load alone can't tell a busy CPU from a Mac out of memory, and the runner reads both.
   - Not measured yet: the ramp on a quiet Mac, and whether `swap: 10` and `timeout: 600` are right. Both are guesses; check them against the next run's last line.
   - Push each image when it is done, so the person can start looking.

8. **Keep the record.** A `lineage.md` beside the output: the plan, the run's last line, the call table, what still fails. Never say an image exists without the file.

9. **After the brand is ratified** (*agent proposal*, from Ben's ask; due when the [ledger](../../../brand/ledger.md)'s Open table is empty). Make `brand/reference/`: one image for each state and component in the constitution's States table, the buttons, the tag, the notice, the gradient card and dark mode, each as a do and a don't, with an `index.json` holding each file's `take` and `leave`. From then on a plan attaches from that folder in place of the downloaded references and in place of words, and a critic judges against it.

Retire when: Codex's own image loop judges as well as this without being told.
