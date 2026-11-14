# How do we guide capture so the user never has to decide what to shoot?
Researched 2026-11-14 by Ben (Claude Code). Feature: capture.

Goal from Ben: "the app says take a big picture take a back picture take a tag picture take close up of this take pictures of defects etc. and its all super intuitive and the user has to do no thinking at all."

## What exists

| Reference | What it does | Take | Tag |
|---|---|---|---|
| eBay magical listing, visual identification (Nov 11, 2026) | Seller shares a photo; AI identifies the item and fills fields; seller reviews and publishes. US, UK, DE, FR, IT, AU. eBay says 10M sellers used its AI features, 800K new listings a day. | Identification from one photo is now table stakes. Our edge has to be the capture quality, the measurements and the transparency, not "AI fills in the title". | observed, https://www.digitalcommerce360.com/2026/11/11/ebay-visual-identification-magical-listing-tool/ |
| Size AI capture guide | Flat lay on a contrasting surface; two circles align into one green circle with a haptic tap; distance readout green at about 0.9–1.4 m; lighting indicator must be green. | **Gate the shutter on live checks** (level, distance, light, contrast) instead of telling users rules. | observed, https://sizeai.co/guides/capture |
| IKEA Kreativ scan | Pre-capture checklist, then a preview-before-confirm step. | Preview each shot with a single "looks good / retake" choice. | observed (in `secondhand-concept/research/direct-references.md`) |
| Apple Vision framework | Subject masks, rectangle detection, text recognition, barcodes on device. | Live on-device checks: subject in frame, card detected, label legible. | asserted (from memory) |

## Recommended design

- **A per-category shot list, chosen after the first photo.** Shot 1 is "the whole thing". A Decisions `choice` question classifies the category (top, pants, shoes, bag, electronics, furniture, other). That picks the remaining list, for example tops: front flat, back flat, tag/label, fabric close-up, each defect. Shoes: both sides, soles, insole tag, box.
- **One instruction per screen, with a ghost outline overlay.** The user only fills the outline. Progress dots show how many shots remain.
- **Each shot is checked before it counts.** Fast on-device checks (blur, exposure, framing) plus one Decisions call per shot: `predicate` "label text is legible", `predicate` "whole garment visible", `score` severity for a defect close-up. Failing shots get a specific retake prompt ("the tag is blurry, move closer").
- **Defects are prompted, not volunteered.** After the front/back shots, the model proposes candidate defect spots ("possible stain, lower left"); the user confirms or dismisses each, then takes a close-up. This puts the decision on the user and makes it easy (Merlin "This is my bird" pattern).
- **The tag shot doubles as the color reference.** Ask for a white sheet of paper or the card in frame on the first flat shot; that gives white balance and scale (see `research/measure/ben/measuring-garments.md` and 4).

## Platform choice

- **Web app (PWA) on the phone** gets camera, file upload and fast iteration; no LiDAR. **Native iOS (SwiftUI + ARKit)** gets LiDAR depth and Vision live checks but costs build time. Recommendation: PWA for the main flow; a small native capture screen only if someone on the team already ships Swift [inferred].

## Risks

- Too many shots feels like work. Cap at about six for clothing; defect shots only when something was found.
- Model-proposed defects can be wrong both ways; always let the user add one the model missed.
