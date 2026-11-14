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

## Added 21:55 UTC: first touch-ups, and what blocks Seedream 5.5

- Four touch-ups from Ben's real photos ran on Seedream 5.0 Pro as a stand-in. Floor, framing, folds, prints and tags all kept (background agreement 0.89 to 0.94). Color drifts a little on two of four (tee less saturated, hoodie lighter). *Agent proposal:* push the item's color back to the white-balanced photo after the render.
- `gate.py` gained the background check (`keep_background=True`).
- Seedream 5.5 has not run: every GitHub Actions job on the repo fails in about 3 seconds with no runner (so does `check.yml`), Ben's Mac has no OpenRouter key, and the cloud environment cannot reach openrouter.ai. Details in the [build plan](../../../../research/studio/ben/build-plan.md#first-look-at-touch-ups-2132-utc-seedream-50-pro-not-55).

## Added 22:55 UTC: photo score and tweaks without a model

- Ben asked for non-generative tweaks and a rough photo score ([words](../../../../product/words.md#2026-11-14-photo-tweaks-without-generation-and-a-photo-score)).
- Built: `research/studio/ben/prototype/photo_score.py` (score, brightness-only tweaks, per-platform crop, search loop with a truth limit) and `judge_prompt.txt` for the decision model. Write-up: [photo-score.md](../../../../research/studio/ben/photo-score.md).
- Finding: no platform publishes how photos affect ranking, so the score is a quality measure and is not fitted to sales. Ben's careful photos gain about one point; deliberately dimmed copies recover from the mid 70s to about 90.
- Open, *agent proposal*: fit the weights to depop-plus listings if they carry views, likes or days to sell.

## Added 23:20 UTC: templates, reference set, C2PA

- Ben's words: [garment templates, a reference set, and reading c2pa](../../../../product/words.md#2026-11-14-garment-templates-a-reference-set-and-reading-c2pa). He also settled level 2: flattening is allowed.
- Built: `research/studio/ben/templates/` (shirt, sweatshirt, pants outlines), `prototype/templates.py`, `prototype/refset.py`, `prototype/c2pa_read.py`.
- For capture: the template outline is the overlay to line the item up with, and `templates.json` has the shot list per garment type.
- Found: asking the model to re-lay a tee into the template redrew the neck tag. *Agent proposal:* templates steer capture and crop; the model only flattens in place.
- Found: Seedream renders carry C2PA that says "made by an AI model", signed by BytePlus. A crop or JPEG save drops it.
- Decided by Ben, 23:18 UTC: exported photos carry no credential and no AI label; studio keeps the model's declaration in its own record ([words](../../../../product/words.md#2026-11-14-no-ai-tag-on-exported-photos-track-it-on-our-end)).
