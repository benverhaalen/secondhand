# Identify

Status: idea. Owner: unassigned. Packet topic: `identify`.

Spec (agent proposal): [spec/features/identify.md](../../spec/features/identify.md).

## What and why
Work out what the item is (brand, model, size, condition) from the photos, using the OpenAI decision API for image decisions. Ben: [words](../../product/words.md#2026-11-14-tools-and-capture).

## How it works
Not designed yet. Keep the mechanism here once research picks one, together with the reference it came from and the job that reference does.

## Decided
- The app is built with Expo, with the camera, ARKit scale and live checks in one Swift module. Ben, 21:05 ([decision](../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)).
- Photo judgements run on OpenAI's Decisions API; Jev runs beside it on text questions and our labels pick. Ben, 21:45 ([decision](../../product/decisions.md#2026-11-14-typed-judgements-run-on-both-the-decisions-api-and-jev-and-our-labels-pick)).

## Open
- What does the seller see when the model is unsure: confirm, or correct?

## Research
All research for this feature: [research/identify/](../../research/identify/)
- Ben: [research/identify/ben/](../../research/identify/ben/)
- Nate: [research/identify/nate/](../../research/identify/nate/)
- Nate: [clarifying-inputs.md](../../research/identify/nate/clarifying-inputs.md). How to ask the few remaining questions fast and hard to get wrong; shipped flows from Mercari and Poshmark, from search excerpts only.
- Nate: [identification-stack.md](../../research/identify/nate/identification-stack.md). Technologies and data sources that can identify an arbitrary used product; image search returns similar items, never proof of identity.
- Nate: [identification-technologies.md](../../research/identify/nate/identification-technologies.md). With Google product search closed, four kinds of technology can identify a used product from photos; claims checked at source, some corrected.
- Ben, tech stack: [openai-decisions-api.md](../../research/identify/ben/openai-decisions-api.md). OpenAI Decisions API returns probabilities but no reasons and no review queue, so we set thresholds and route low confidence to the user.
- Ben, build plan: [build-plan.md](../../research/identify/ben/build-plan.md). Terra, tag reading and image search propose up to 5 identities; one Decisions call verifies them; each field is filled, one-tap confirm, or picked by the person; corrections become labels that retune thresholds in Databricks.
- Ben, harness from repos: [ai-harness-from-repos.md](../../research/cross-cutting/ben/ai-harness-from-repos.md#2-decision-questions-the-jev-lessons). *Agent proposal:* gate on the picked option's probability and its lead, not `confidence`; narrow questions combined in code; a no-model baseline in every eval (Jev repos).
