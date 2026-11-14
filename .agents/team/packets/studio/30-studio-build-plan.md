# 30 — Build plan for studio photos

Updated: November 14, 2026. Owner: Ben. Agent: Claude Code, project thread "Plan the build for studio photo generation". Branch: `main`. Status: plan and prototype written; revised to demo-first; real-photo renders next.

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

## Changed after Ben's steer (21:11 UTC)

Both routes are built and the multi-photo restage leads the demo. The gate ranks several candidates (Seedream seeds plus Nano Banana 2.1) and feeds the approval card; it no longer blocks. Testing moves to Ben's real listing photos in `depop-plus`. See section 0 of the plan.

## Added 21:14 UTC

A studio agent loop (render, gate, masked repair with the real pixels, gate again) runs as a cloud job that emits stages; the app shows them as loading states. The component catalog needs a scene tile with stages `uploaded`, `color_fixed`, `rendering`, `checking`, `repairing`, `ready`, `failed`. See section 0.1 of the plan.

## Changed 21:28 UTC: touch up only

Ben's rule: never change the environment or misrepresent; only touch up. Scene presets and restaging are dropped. Studio now offers three levels on the same photo (true color, light, pressed). List and posting take a per-platform default level from the posting research. See the top of the plan.

## Next action

Get a BytePlus or OpenRouter key for Seedream 5.5 and rerun `run_real.py` on 5.5 renders, including the multi-reference prompt.
