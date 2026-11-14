# Stage 4. Critique, combine and loop

Open when: full size, once direction images exist. The same transitions run in the check stage.

## Criteria first

Write the criteria to `brand/screens/<screen>.critique.md` before any critic looks, weighted from the four screen lines: fit to the main task and its frequency; safety on the worst-consequence task; clarity of the primary action; brand presence; coherence with the screens that already exist.

## Critique

1. A fresh helper sees the candidate images (attached as images), the image card and the four lines. It does not see which candidate the generating agent prefers or its reasoning.
2. It returns localized observations and accept, revise or reject per candidate, with reasons.
3. The generating agent checks each observation against the pixels before acting on it. Agreement is not approval; disagreement points to a discriminating comparison.

## Why the critic's word is not final

Model judges of UX are imprecise in every study that measured them:
- GPT-4 audits were 19.9% accurate in Baymard's test (live sites, 2023).
- In a MeasuringU test 1 of 11 AI-only findings was genuine (two models, one video).
- GPT's predicted click distributions differed significantly from real participants' in 53% of tasks (12 tests, 3,431 participants).
- Twenty professional designers agreed with each other at only Krippendorff alpha 0.25 (12k UI pairs).
- Anthropic found its own evaluator (Opus 4.6 era) "confidently praising the work", and "museum quality" pushed designs to one look.
Sources: ux-structure-verification.md:81, 84, 90; ui-expert-process.md:45, 47. So critique findings are hypotheses; anything countable goes to a script; brand feel goes to him only at the brand stage and the whole-app check.

## Combine

1. Merge rather than pick: "the header from B with the sidebar from C". In a 1996 usability study of four parallel designs by people (reported by NN/g), a merged design beat the best single one (70% against 56% above average); that this carries over to agent-made images is a guess. Do not merge every proposed feature into one screen (image-ideation-example.md).
2. Each borrowed part carries one line saying why.
3. Regenerate the merged direction as one image and have a fresh helper critique it once more.

## The loop

Keep a small state file `brand/screens/<screen>.loop.json`: `{"stage": "directions|check", "round": n, "best": "<image or build id>", "accepted_findings": [...], "rounds_without_new": n}`.

1. Critique passes: go to build.
2. Insufficient: change the brief (a different axis, a sharper user situation, a different reference job) and regenerate. Re-running the same brief with new seeds is not a change. If he reported over-prescription or an AI-looking result, change the next generation operation itself, not just a saved principle (his method).
3. Stop rule: stop when the critique passes, or when two rounds in a row bring no new accepted finding (the stall idiom from Claude Code's workflow docs). Then show him the best candidate so far, not the latest, with the remaining findings. Loops can pick the wrong winner (agent-loops-verification.md:13, :28), hence best so far.
4. In the check stage: fix, recheck, and stop on two rounds with no progress the same way.

This loop reworks one screen inside one task. It is not the self-improving project loop, which `build` offers only for a project with an event log and one frozen measuring command, and runs only after his yes.
