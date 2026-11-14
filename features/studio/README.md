# Studio photos

Status: idea. Owner: unassigned. Packet topic: `studio`.

## What and why
Regenerate clean photos from all the captured shots. Lighting presets are studio, garage and house, with color correction, using Seedream 5.5 rather than OpenAI's image model. The idea works like a video model that takes reference images of a person: the many photos become a precise representation of the item. Ben: [words](../../product/words.md#2026-11-14-tools-and-capture).

## How it works
Draft from the design canvas: Studio, Garage, Home and Original scenes, built from all the shots. Color is anchored to the tag shot, and each result is checked against the original photos.

## Decided
Nothing yet. Each entry here links to [decisions.md](../../product/decisions.md).

## Open
- How do buyers still see the real condition? (See the vision's Open section.)

## Research
All research for this feature: [research/studio/](../../research/studio/)
- Ben: [research/studio/ben/](../../research/studio/ben/)
- Nate: `research/studio/nate/` (none yet)
- Ben, tech stack: [seedream-relighting.md](../../research/studio/ben/seedream-relighting.md). Color-correct real photos first, render with Seedream 5.5 from up to 10 references, reject any render that drifts; real photos stay as evidence (eBay picture policy).
- **Rule (Ben, 21:28 UTC): touch up only, never change the environment or misrepresent.** [Words](../../product/words.md#2026-11-14-photos-touch-up-never-change-the-environment). Scene presets and restaging are dropped; see the top of the build plan.
- Ben, build plan: [build-plan.md](../../research/studio/ben/build-plan.md). Edit the main shot in place so every render can be checked against it; card-based color correction; a gate (alignment, color, structure, each logo, tag and defect box, OCR, Decisions) that a 6-render Seedream test and a seeded-fault test exercised; a person approves each render. Revised after Ben's steer: the multi-photo restage is built too and leads the demo, and the gate picks the best of several candidates instead of blocking.
