# 89: one capture client, and the prefilled choice, for Ben

Owner: Ben. From: Nate's side, the capture lead (Claude Code, Opus 5.5), 2026-11-15. Status: a decision on our side, and two lines on your screen that are yours to make.

## Your client stays the only one

Your `app/src/capture/client.ts` (edbf3f64) is the capture client. Our scaffold (`w/cap-ask-1`: a second client in `app/src/api/capture.ts`, a fold in `app/src/capture/wire.ts`, a dev screen) is parked and will not merge. Reasons: your `live.tsx` already renders every question kind on your client, and your client sends a number as the server checks it, while the scaffold's `{value, unit}` shape gets a 422. Nothing of yours moved.

## The prefilled choice (Nate's "selects prefilled from identify")

`live.tsx` `Answer` gives `ChoiceChips` `value=""`, so the proposed option is never shown as chosen. Every option the plan proposes carries `proposed: true` (and, after the route join, `rests_on`: why it is proposed, such as "RN 14806 on the tag"). The smallest change, if you want it:

```tsx
value={String(question.options.findIndex(option => option.proposed))}
```

with `-1` meaning nothing chosen, and for `pick_many` the initial `selected` set to the proposed values. How the reason shows (a caption under the chip, or nothing) is yours.

## Coming from capture, for your screen

- **Editing a fact already known** (your packet 83): `PATCH /v1/captures/:id` with `{version, edit: {field, value}}`. It takes any field that already holds a value, checks it like an answer, and stores it as the person's word. It is in the route-join piece now building; this packet gets a line when it lands on main.
- **Real upload addresses**: the photos route returns the server's signed address once the server lead's `Blobs` store is composed; until then it is still the example address your client already refuses.
- **Identify results**: the identify job writes the brand and model candidates into the plan's questions (proposed option first), so your question sheet shows them with no change. Its job row's `result` keeps no listing titles or links: our terms keep only our own candidate. So `results.tsx`'s "Open listing" for identify will show "Listing link not available" for a tag or Lens match. That is by design, not a gap.

## One question part for capture and the buying chat (added 2026-11-15)

Nate, relayed by the orchestrator: "I think we can add those clarifying question widgest to the intelligent ui too." So the buying chat's answers will carry the same question block as capture (`Ask`, [capture.md §4](../../../../spec/engines/capture.md#4-what-bens-screen-calls), "The question block, shared with the buying chat"), and one drawn part should serve both. The ask, yours to shape: lift the `Answer` in `live.tsx` into a part in `app/src/ui/parts/` that takes an `Ask` and `onAnswer(value)`, preselects the `proposed` option and can show `rests_on`. Capture's sheet and the chat then both use it; nobody forks a second widget. The engines lead emits the block from the conversation route.

## Two things from the simulator walk (added 2026-11-15)

The app-walks lead ran Sell on an iOS simulator. Uploads now get a real address on main (eaec5743); two points for `live.tsx`, both yours to decide:
- **HEIC from the library.** `library()` labels every non-PNG pick `image/jpeg`, but iOS can hand back HEIC. The server reads the type from the bytes and answers 415 "send JPEG or PNG" for HEIC (its metadata cannot be stripped safely). Asking the picker for JPEG (for example a `quality` below 1, which makes it re-encode; check expo-image-picker's docs for SDK 58) or converting before upload avoids it. The camera path already sends JPEG.
- **Location in picked photos.** iOS shows "Location Is Included" for the picked photos. The server strips all EXIF but orientation before storing (tested), so nothing with GPS is kept; but the bytes cross HTTPS to our server with it. Stripping on the phone too (a re-encode before upload) is the stricter default.
