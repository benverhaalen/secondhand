# How do capture, measure and identify fit into one pipeline, and where do the three build plans disagree?
Researched 2026-11-14 by Ben (Claude Code). Feature: cross-cutting.

This joins three build plans written today with the RDD loop and seeded research from `it-already-exists`: [capture](../../capture/ben/build-plan.md), [measure](../../measure/ben/build-plan.md) and [identify](../../identify/ben/build-plan.md). Each claim's evidence mark lives in those notes. This note only adds the joins, so its own claims are *inferred* unless marked. Everything here is an *agent proposal* until Ben or Nate picks.

## One item, start to finish

| # | When | Where it runs | What happens | What the person does | Source note |
|---|---|---|---|---|---|
| 1 | Shot 1, "the whole thing" | Phone | One ARKit session. Live checks gate the shutter: tilt and distance from the floor plane, one item in frame, blur, exposure. Auto-shoots when stable. | Points the phone. Manual shutter always there. | capture, steps 0 to 1 |
| 2 | Right after shot 1 | Backend | Decisions call for the shot's quality questions; a GPT-6.1 Terra structured read gives category and color. The category picks the rest of the shot list. | Picks a category chip only when unsure. | capture step 3, identify 4.1 |
| 3 | Front and back flat-lay | Phone, then backend | The same frame carries the camera's intrinsics and floor plane, so scale comes for free. Mask from Apple Vision plus SAM 3.1; points from width-profile geometry plus Gemini pointing. | Nothing yet. | measure, scale and points |
| 4 | Tag shot | Phone | On-device text recognition reads brand, size, RN, materials; Terra cleans it up. | Retakes only if the tag is unreadable. | capture, identify 4.2 |
| 5 | After front and back | Backend | Gemini proposes flaw boxes; Decisions scores each crop; SAM draws the highlight. | Yes or no on each proposed flaw, then a close-up of each yes. Can add one the model missed. | capture step 4, identify 4.5 |
| 6 | After the last shot | Backend, in parallel | Lens via SerpApi plus eBay image search plus Terra propose up to 5 exact identities. One Decisions call (about 20 questions) verifies them. Measure lines are checked by Decisions. | | identify 4.3 to 4.4, measure checking |
| 7 | About 9 s after the last shot (target, unmeasured) | App | One filled item card. Each field is in a band: filled, one-tap confirm, or pick. Measure lines sit on the photo with draggable ends. | Fixes what's flagged, taps "Looks right". Each tap or correction is a Decision row and a label. | identify 4.7 to 4.8, measure approval |
| 8 | Then | Backend | Verified matches become comps for [price](../../price/); real photos plus the white-sheet reference go to Seedream for [studio](../../studio/). | | identify 4.9, capture dual-purpose table |

Every step writes an MLflow trace and a Delta row, so the "why?" sheet can show what each field came from.

## Where the plans disagree

| Topic | Capture says | Measure says | Identify says | Proposed resolution |
|---|---|---|---|---|
| App shell | Expo SDK 58 app with a Swift `CaptureKit` module | Small SwiftUI capture app; everything after the shutter is web (opened in a web view or handed off) | Either; prefers native for on-device tag reading | **Ben answered "app first, website if we have time" at 20:59** ([words](../../../product/words.md#2026-11-14-app-first-website-if-time)). He then picked an Expo app with a Swift camera module at 21:05 ([decision](../../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)). Approval screens render in the app with `@json-render/react-native`. The earlier recommendation was measure's version, because the dynamic UI plan ([generative-ui.md](../../today/ben/generative-ui.md)) builds every approval card in a React 19 web app with json-render and shadcn. An Expo app would need those components twice. A Swift capture screen that uploads and hands off keeps one UI. The decision is Ben's (below). |
| Who draws flaw boxes | Gemini 3.8 Flash | n/a | Gemini, with per-tile Decisions checks | Agree. Decisions can't return locations [observed in both notes]. |
| Card in frame | Needed only on web | Native needs nothing extra; card on web only (in FitTag's simulated tests, card-only was off by 22 to 35 cm) | n/a | Agree. The white sheet stays for color. |
| Object Capture | Not used for clothing | Stretch goal; a forum bug report says it fails on iPhone 17 Pro under iOS 26.x | n/a | **Build it** (see Demo mode below). |

## Changes to Ben's named tools

- **OpenAI Decisions API**: kept for every judgement. It is GA since Oct 22, on `gpt-6-luna` only, and can't name things or place points or boxes (identify note, loop 1, observed). So a generator (Terra, Gemini) proposes and Decisions verifies.
- **LiDAR and Apple measuring**: kept, but scale now comes from the ARKit floor plane, which works without LiDAR. LiDAR cross-checks it.
- **Apple Object Capture**: built for rigid items (see Demo mode below).
- **Added**: Gemini for boxes and points, SAM 3.1 for masks, SerpApi Google Lens and eBay image search for exact identity.

## Demo mode: build it, don't drop it

Ben, 21:08: "this is a product demo, getting something that works for a hackathon is different from writing a production app ... we can also just build things" ([words](../../../product/words.md#2026-11-14-demo-not-production)). So everything the three notes demoted for production reasons goes back in. A risk only matters if it would break the demo on stage, and then the answer is a backup path, not a cut.

| Idea | The notes said | Now |
|---|---|---|
| Apple Object Capture | Stretch goal; a forum report of failures on iPhone 17 Pro | **In the demo** for shoes, bags and objects: walk around, get a USDZ and its metric box, show it spinning in the item card (RealityKit view in the Swift module). Backup if it crashes on the demo phone: the one-frame LiDAR box. |
| 3D for clothes | Single-image 3D (TRELLIS, Hunyuan3D, SAM 3D) has no metric scale, so not used | **In the demo.** Generate a 3D model from the front, back and spin photos, then scale it to the measured lengths, which fixes the scale problem. Shown labelled as a model next to the real photos. |
| 10 s spin shot | Optional, capped at 6 shots | **In.** It feeds the 3D model, Seedream's angles and a 360 view on the listing. |
| Constant-color shot (Apple, D65) | Stretch | **In** as one extra tag or fabric shot that gives Seedream true color. |
| Google Lens through SerpApi | Asked Ben because of a terms gray area | **Use it.** |
| "Fits like" against brand charts | About 10 charts | Cover every brand on the demo rack plus the common ones (Carhartt, Patagonia, Levi's, Nike, Uniqlo...). |
| Website with a card for scale | Only if there's time | Unchanged: Ben said app first. |

Kept on purpose, because they are the human in the loop judges want to see: yes or no on each flaw, dragging measure lines, "Looks right".

## Best API wins, and several at once where that helps

Ben, 21:13: "if you think theres an api or multiple possibilties for it that would work better we are fine paying for api costs" ([words](../../../product/words.md#2026-11-14-paying-for-better-apis)). The three notes already ignored price, but in a few places they picked one fast model where a stronger one, or several run together, would likely be more accurate. *Agent proposal*, all *inferred* until the day-one run on our own items:

| Step | The notes picked | Now |
|---|---|---|
| Flaw boxes | Gemini 3.8 Flash alone | Run the Flash and the strongest Gemini model plus a second vendor's vision model at once, and merge the boxes. Flaws two models agree on are pre-ticked; single-model ones are shown as "maybe". Decisions still scores each crop. |
| Exact identity | Terra plus Lens plus eBay image search | Add the strongest GPT and Gemini models as extra proposers. More candidates cost nothing in time, because one Decisions call verifies them all. |
| Seam and shoulder points | One Gemini pointing model, 3 runs | Add a second pointing model; where the two disagree, the line is flagged for the person first. |
| Masks | Apple Vision plus self-hosted SAM 3.1 | Use a hosted SAM 3 endpoint (fal or Roboflow) so no GPU setup is needed. |
| Tag reading | On-device text plus Terra | Also send the tag photo to a second model; a mismatch drops the field to one-tap confirm. |

The limit is time on stage, not money: everything extra runs in parallel and must not push the filled card past the 9 s target.

## What has to be measured on day one

None of the latency or accuracy numbers in the three notes have been run on our own items. First hour: Decisions latency on images, Gemini flaw recall on 10 real garments, tape-measure error on 10 garments, Object Capture on the demo phone.
