# The photo pipeline constitution

How a seller's photos become listing photos without lying, and how we prove they don't. The method is in [spec/features/studio.md](../../spec/features/studio.md) and [features/studio/](../../features/studio/README.md); the shots are [spec/determinations/capture-shots.md](../../spec/determinations/capture-shots.md); the score is [photo-score.md](../../research/studio/ben/photo-score.md); the check is `jobs/studio/check.py`. *Agent proposal*.

## The problem

Real secondhand photos are wrinkled, badly lit and framed differently every time, and buyers decide on the first photo. Better photos sell. But a photo that changes the item is a lie: it causes returns, platform trouble and distrust, and a mentor raised exactly that worry ([05:05](../words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all)). The job is to make every photo look as if the seller had ironed the item and laid it out in good light, change nothing a buyer would care about, take almost no effort from the person, and be able to prove all of that to a skeptic with a tape measure.

**Success, checkably:** every AI photo that posts measures within tolerance of the tape on pit-to-pit and length, or it doesn't post; a stranger shown original and result side by side says "same shirt, ironed"; the person can turn every fix off.

## Ends

| End | Test |
|---|---|
| Nothing about the item changes | Measurements, color, print, flaws and tag match the original within tolerance |
| It looks better | The photo score rises, and the slide set follows the template for its kind |
| It's provable | The measured overlay can be shown on the site and at the table |
| The person stays in charge | Both kinds of fix are toggles; their own photos post untouched if they want |

## Rules

**F1. Touch up, never change the scene or the thing.** Only how flat it lies changes: "if you were to take the shirt and iron it out it would look like that. but not changing the actual shirt" ([23:31](../words.md#2026-11-14-re-lay-iron-and-audit-the-measurements)); "it shouldnt change the environment or lie. it should touch up" ([21:28](../words.md#2026-11-14-photos-touch-up-never-change-the-environment)).

**F2. Two kinds of fix, both optional.** Plain fixes with no generation (light, contrast, crop, straighten) and AI fixes. *Why:* the mentor's concern; "we can allow both ai enhancement and deterministic enhancement" ([05:05](../words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all)). AI retouch is off until asked (Nate's answers, [words](../words.md#2026-11-14-nate-answers-to-the-first-ten-questions-for-ben)).

**F3. No measurements, no AI photo.** An AI photo passes only when it measures true against the item; otherwise it is reset to the tape's shape or rejected. *Why:* "it actually can only ai beautify if you have dimensions or else you cannot trust it ... we only let it pass once its accurate" ([08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams)). Check: `jobs/studio/check.py`.

**F4. The proof is shown, not claimed.** A measured overlay (pit to pit, length) on original and result, for the site and the pitch ([07:51](../words.md#2026-11-15-prove-the-photos-with-the-tape-measure)). The words are "every AI photo is measured against your tape before it posts".

**F5. One shot list serves the listing and the model.** The guided shots are the listing's photos and the model's references at once ([18:48](../words.md#2026-11-14-shots-serve-both)); the person takes each photo, guided like ID verification ([03:17](../words.md#2026-11-15-new-takes-the-screen-a-live-point-cloud-stage-bubbles-and-the-found-pop-up-item-details-per-site-the-person-takes-the-photo-a-male-voice)); the frame is the listing's aspect ratio ([06:19](../words.md#2026-11-15-notes-on-the-first-gallery-today-must-explain-itself-you-is-a-dashboard-the-camera-frames-the-listing-photo)).

**F6. A template per kind of garment, and a fixed slide order.** Tee, long sleeve, sweatshirt, pants: what slide 1, 2, 3 show, where graphics sit, and how the defect photo stays real ([06:01](../words.md#2026-11-15-the-photo-templates-demos-that-let-the-magic-talk-and-monitors-and-manages-markets-for-you), [23:01](../words.md#2026-11-14-garment-templates-a-reference-set-and-reading-c2pa)).

**F7. The image model is Nano Banana, through OpenRouter.** Ben first asked for Seedream 5.5 ([18:32](../words.md#2026-11-14-tools-and-capture), [08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams)); OpenRouter doesn't carry it, and he chose to "stay on nanobanana" ([08:33](../words.md#2026-11-15-nano-banana-stays-app-store-coming-soon-the-voice-waits)). Retires if OpenRouter adds Seedream 5.5 and Ben asks again.

**F8. A score decides when to stop.** A decision model scores each photo against what sells on each site and tweaks until it stops improving ([22:23](../words.md#2026-11-14-photo-tweaks-without-generation-and-a-photo-score)).

**F9. No AI label on the exported photo; we track it.** "worst case scenario is everything works beautifully but we cant post because we added an ai tag" ([23:18](../words.md#2026-11-14-no-ai-tag-on-exported-photos-track-it-on-our-end)). Where a site requires a label, it gets one. C2PA from the source photo is read and kept ([23:01](../words.md#2026-11-14-garment-templates-a-reference-set-and-reading-c2pa)).

**F10. The person's own photos are always accepted.** Uploading their own, or refusing AI entirely, is one tap off the main path ([03:55](../words.md#2026-11-15-no-missing-functions-walk-every-feature-for-what-would-frustrate-each-person)).

## Open

- Ben saw the redraw removing fewer wrinkles than he expected (07:51). Whether to push the wrinkle level is a taste call.
- The defect photo has no tested method yet.
