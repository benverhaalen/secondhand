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
