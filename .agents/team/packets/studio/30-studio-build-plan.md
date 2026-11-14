# 30 — Build plan for studio photos

Updated: November 14, 2026. Owner: Ben. Agent: Claude Code, project thread "Plan the build for studio photo generation". Branch: `main`. Status: plan and prototype written; one decision waiting on Ben.

## Scope

[research/studio/ben/build-plan.md](../../../../research/studio/ben/build-plan.md) and its [prototype](../../../../research/studio/ben/prototype/README.md): color correction from a white card, Seedream relighting into studio, garage and home, a fidelity gate, and the approval card. Ben's ask: [words](../../../../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui).

## What was found

- Editing the main shot in place keeps the framing almost to the pixel (6 Seedream 5.0 Pro renders, alignment 0.93 to 0.99), so each render can be checked region by region against the real photo. Logos, labels and a toe scuff survived; one studio render exaggerated the canvas texture and was caught by the color check.
- Free restaging from all references (Ben's "reference-to-video" idea) produced a plausible but different jacket and can't be verified this way.
- No Seedream 5.5 host offers a mask; only BytePlus exposes a seed.

## Affected interfaces

- **Capture** ([packet 22](../capture/22-capture-measure-identify-plan.md)): the main shot needs a white card or paper in frame; defects confirmed in capture need a box on the main shot. The native ARKit capture screen in packet 22 can also lock white balance across shots.
- **Identify**: a call that boxes every logo, label and printed text on the main shot, and the item's material, hardware and logo names to fill the prompt.
- **Component catalog** ([packet 4](../list/4-posting-messages-dynamic-ui-plan.md)): a render approval card (before/after slider, one chip per protected box, flagged tiles, Use / Redo / Fix texture / Use real photo).
- **List**: photo order is evidence photo first, approved renders next, real close-ups last; no text or badge in the pixels.
- **Data**: one Delta row per render with every check's number and the person's choice.

## Decision for Ben

In-place renders (verifiable) as the default for every preset, with restaging as a labelled extra. Asked in the project thread.

## Next action

Get a BytePlus or OpenRouter key for Seedream 5.5 and rerun `run_real.py` on 5.5 renders, including the multi-reference prompt.
