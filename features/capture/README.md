# Guided capture

Status: idea. Owner: unassigned. Packet topic: `capture`.

Spec (agent proposal): [spec/features/capture.md](../../spec/features/capture.md).

## What and why
The app walks the seller through each shot: the whole item, the back, the tag, close-ups and defects. The seller never has to think about what to shoot. Ben: [words](../../product/words.md#2026-11-14-tools-and-capture).

## How it works
Draft, revised after Ben's direction ([words](../../product/words.md#2026-11-14-shots-serve-both)). There is one shot list, and every shot serves both the listing and the image model. There are no separate reference shots.

| Shot | For buyers | For the image model |
|---|---|---|
| Front, back | Listing photos | Main views |
| Tag | Size and brand | Exact fabric color |
| Fabric close-up | Texture | Texture kept when relighting |
| Flaws | Disclosure | Constraints it must preserve |
| Spin (10 s walk-around) | 360 view | Shape from every side |

Then [measure](../measure/). The item lies on a white sheet from the first shot, so every image carries a white-balance reference. The list is chosen per item type, and shots capture automatically once they are sharp.

**Where photo bytes go** (decision brief, capture lead, 2026-11-15; F21 in [capture engine §8](../../spec/engines/capture.md#8-what-is-wrong-named-fixes-and-their-tests)):

```
Question: where does a kept photo's file live, so identify, photo scoring and studio can read it?
Decides: agent (the means); a billed bucket would be Nate's
Common answer: a presigned S3 upload. Dropped for now: it adds a billed service and a key, and one always-on server with a disk is already the plan (finalization SV1, SV4).
A: our own route, PUT /v1/captures/:id/photos/:photo_id/bytes, owner checked, size and type checked against the photo row, EXIF stripped, written through a photo-store port to the server's data folder. Rests on finalization.md SV1 and SV4 [the plan]. Wrong if uploads over mobile data through our server are slower than the 9 s identify budget (spec/features/identify.md), or the disk fills.
B: presigned bucket (S3, R2, Supabase Storage). Rests on the same port. Wrong if its bill or key handling is not worth it at our volume.
C: Databricks Volume. Rests on spec/product.md (files V). Wrong if a write from the phone path through the workspace is slower than A; today the served app touches the workspace in one place only (audit item 9).
Recommend: A behind the port, because it needs no new service, key or bill and works on the dev server today. Strongest rival: B, which the same port takes later without a route change.
```

Research: [capture tech docs, 2026-11](../../research/capture/nate/capture-tech-docs-2026-11.md): Object Capture still needs LiDAR; a LiDAR phone can still fail a scan; expo-camera has no depth; Vision reads UPC-A as EAN-13.

## Decided
- Capture opens on the guided shot list; a voice button starts talk mode. Ben, 21:33 ([decision](../../product/decisions.md#2026-11-14-capture-opens-on-the-guided-shot-list-talk-mode-is-one-tap-away)).
- The app is built with Expo, with the camera, ARKit scale and live checks in one Swift module. Ben, 21:05 ([decision](../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)).

## Open
- Should Apple Object Capture (a 3D model from photos) feed measure and studio? Ben asked for it to be researched: [words](../../product/words.md#2026-11-14-pavlo-and-appraise).
- Does the shot list come from presets per category, or is it chosen live from the first photo?

## Research
All research for this feature: [research/capture/](../../research/capture/)
- Ben: [research/capture/ben/](../../research/capture/ben/)
- Nate: [research/capture/nate/](../../research/capture/nate/)
- Nate: [adaptive-capture.md](../../research/capture/nate/adaptive-capture.md). Evidence on one adaptive capture session versus a fixed shot list, with ARKit depth facts: 256 x 192 depth map, accurate to about 1 cm on small objects.
- Nate: [scan-to-images.md](../../research/capture/nate/scan-to-images.md). How a LiDAR scan or Object Capture model can become listing and identification images, compared with using the captured photographs themselves.
- Ben, tech stack: [guided-shot-list.md](../../research/capture/ben/guided-shot-list.md). Per-category shot list with live checks before each shot counts; defects proposed by the model and confirmed by the user.
- Ben, build plan: [build-plan.md](../../research/capture/ben/build-plan.md). One ARKit session with live checks and auto-shutter; one Decisions call per shot; Gemini proposes flaw boxes, the person confirms each; folder drop groups photos into items. Joined with measure and identify in [seeing-the-item-pipeline.md](../../research/cross-cutting/ben/seeing-the-item-pipeline.md).
- Ben, build plan: [live-video-capture.md](../../research/capture/ben/live-video-capture.md). Talk mode ([Ben's words](../../product/words.md#2026-11-14-live-video-you-can-talk-to)): a live voice and video session directs the same shot list. The model asks for a better look, takes the stills itself through tools, and saves what the seller says as "you said" facts; a Heard / Saw screen is the approval. Gemini 3.8 Live first, OpenAI Realtime as backup. *Agent proposal.*
- Ben, build plan: [decision-tree-capture.md](../../research/capture/ben/decision-tree-capture.md). Talk mode reworked ([Ben's words](../../product/words.md#2026-11-14-video-capture-as-a-decision-tree)): a decision tree in code runs the video, the Decisions API answers each branch from a frame about once a second, and set spoken lines correct the seller until a shot passes. Trees assemble from sub-trees switched on by what the item has (a tag, a graphic, soles). Replaces the live-model director in live-video-capture.md. *Agent proposal.*
- Ben, build plan: [capture-coaching-and-frames.md](../../research/capture/ben/capture-coaching-and-frames.md). Amends the decision-tree plan ([Ben's words](../../product/words.md#2026-11-14-capture-voice-frame-quality-measuring-skipping-and-video-storage)): full friendly spoken sentences with captions; a ranked list of what makes a frame read well to the Decisions API (pixels on the subject and sharpness first, so a native-size crop goes with each frame); framing against studio's garment templates with an outline-alignment test; measuring inside the front-flat step; every step skippable with a recorded reason; video storage tiers. *Agent proposal.*
- Ben, what every item needs per site and in what order: [item-attributes-by-site.md](../../research/capture/ben/item-attributes-by-site.md). Each site's category tree, attributes, limits and condition scales; one item record mapped to every site; a 12-stage tree from the first photo to a postable listing, each stage with who answers it and the camera's one instruction; and the form walks that need Ben's account. *Agent proposal* for the tree and the three new fields.
- Ben, the capture frame: [listing-photo-frame.md](../../research/capture/ben/listing-photo-frame.md). Each site's photo shape and size (eBay, Depop, Poshmark, Mercari, Facebook, Vinted, Etsy, Grailed, OfferUp); capture 3:4 portrait with the item inside the centered square, so one still crops to 3:4, 4:5 and 1:1 without padding, at 2000 px or more on the short side. *Agent proposal.*
