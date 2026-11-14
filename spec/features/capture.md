# Capture
Status: draft, *agent proposal* except where a line links a decision. Slug: capture. Written 2026-11-14.

Today a seller photographs an item from guesses, finds the flaw a buyer will complain about after the sale, retypes the tag, and gets asked "measurements?" in the messages. Capture takes that off them: point the phone, follow one instruction at a time, and the item leaves with photos, read text, flaws and the numbers that let the rest of the app work. Ben: "the user has to do no thinking at all" ([words](../../product/words.md#2026-11-14-tools-and-capture)).

## What the person does and sees

Capture lives under ＋ in the bottom bar ([decision](../../product/decisions.md#2026-11-14-the-bottom-bar-is-today--sell----buy--you)). It ends by offering Sell this, What's it worth, or Find this.

| Step | The person | The app |
|---|---|---|
| 1 | Taps ＋. | Opens the camera on the guided shot list, offline-capable ([decision](../../product/decisions.md#2026-11-14-capture-opens-on-the-guided-shot-list-talk-mode-is-one-tap-away)). |
| 2 | Points at the item. | Within the first frames the item picks its list ([decision](../../product/decisions.md#2026-11-14-capture-is-one-session-and-the-item-picks-the-mode)): flat clothes get flat-lay, tag, flaws; rigid things and furniture get a list whose first step is a move-around scan with a live coverage ring, plus depth on LiDAR phones. |
| 3 | Holds steady, or walks around. | Auto-shutter when the live gates pass ([Ben's build plan](../../research/capture/ben/build-plan.md) Step 1); the shutter button is always there. Each kept shot shows a 3 s undo. |
| 4 | Sees one prompt, sometimes. | One more view is asked for only when it would change a field (below). |
| 5 | Taps the voice button, if they like. | Talk mode over the same list; switching back loses nothing. |
| 6 | Answers at most a few questions after capture. | Only questions that pass the clarify test (below). |
| 7 | Picks Sell this, What's it worth or Find this. | The item moves to `researching`. |

**How the mode is picked.** On the phone, the first frames give a provisional class from Apple Vision plus plane and extent cues (lying flat on a plane, soft outline, LiDAR extent where present). The first kept still goes to the cloud category judgement ([Ben's build plan](../../research/capture/ben/build-plan.md) Step 3, the 12 categories with `is_rigid` and `is_flat_layable`), which confirms or swaps the list. Offline, the phone's pick stands until upload. Because both lists share one store of shots, a swap keeps every photo.

**One more view.** Asked only when the next view would move a field across a band the item card shows (a measurement leaving its ±, a flaw unconfirmed, a tag unread, coverage below what Object Capture needs). At most 2 per item. Worded as one short instruction with an arrow or outline, per [copy.md](../../product/copy.md): "Turn it over", "Closer on the tag", "Show the back corner". Nate's note finds no shipping app that does this on demand (adaptive-capture §5, *sourced*); whether it beats a fixed list is untested (§6).

**Talk mode.** As in [live-video-capture.md](../../research/capture/ben/live-video-capture.md): the live model watches, asks for views, takes stills through tools, and saves what the seller says as `you_said` with the quote and a clip. Its Heard / Saw recap is the approval.

**Phones without LiDAR.** The same lists. The scan still gets poses, a floor plane and pose-only coverage; depth and Object Capture do not run (adaptive-capture §2, §4). Sizes come from the plane, a card or a known length and show as estimated where no cross-check exists ([measure](measure.md)).

**Folder drop and website upload.** A dropped folder runs `folder_group` and ends in one `approve_groups` decision ([Ben's build plan](../../research/capture/ben/build-plan.md) Step 7). The website takes photo upload in place of LiDAR and the guided camera ([decision](../../product/decisions.md#2026-11-14-the-phone-app-comes-first-a-website-follows)); uploads join the same judge, flaw and grouping jobs, and the list shows which shots are still missing.

**Clarifying questions.** Asked only when the answer changes identity, value, a claim or the handover, and no photo, read text, product match or link can settle it. Examples: "Does it power on?", "Measure between these two points" (Nate, research session). Working condition is never decided from photos ([identify plan](../../research/identify/ben/build-plan.md)).

**A product link or receipt.** Optional, any time: paste a link or snap a receipt. It is stored as identity evidence, never proof of the exact variant: "An original purchase URL is evidence, not proof" (Nate). "if they can't thats ok" (Nate).

## What it reads and writes

| Entity | Fields written |
|---|---|
| `item` | new id in `capturing` |
| `capture` | `mode` (guided, scan, talk, folder, web), device model, `has_lidar`, OS version, coverage, started and ended times |
| `photo` | role (Ben's 12 roles), gates passed, pose, intrinsics, mask ref, depth and depth-confidence refs (LiDAR only), read text, source (camera, folder, web) |
| `attribute` | tag text and care label as `label`; seller's words as `you_said`; flaws as `inferred` until confirmed |
| `decision` | retake, category_unsure, missing_shot, confirm_flaw, approve_groups, clarify |
| `event` | one per step, ids only |

Reads: the product match from AI Search (to skip shots a known product does not need), past labels for gate thresholds.

## States

| From | To | Trigger |
|---|---|---|
| (none) | `capturing` | ＋ tapped or folder dropped |
| `capturing` | `researching` | person picks Sell this, What's it worth or Find this, and the uploads have arrived |
| `capturing` | `failed` | every upload retry has failed and the person discards |
| `capturing` | `kept` | person keeps the item out of selling |

Sub-stages inside `capturing` (framing, shooting, uploading, judging) are under Needs.

## Systems underneath

| Piece | Does here |
|---|---|
| Swift capture module ([decision](../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)) | camera, gates, ARKit depth and pose, Object Capture, on-device mask and text, EXIF strip, face and screen blur. Writes no log lines; sends events to JS, which logs them ([log/README.md](../../log/README.md), [events.json](../../spec/events.json)). |
| Public edge | issues signed upload URLs |
| UC volume | full JPEG and the 1536 px copy, depth, masks, USDZ |
| FastAPI on Apps | captures, photos, decisions |
| Lakeflow jobs | `capture_judge`, `defect_propose`, `folder_group` |
| Model gateway | category and gate judgements on the image path, kept separate from text ([decision](../../product/decisions.md#2026-11-14-image-decisions-and-text-decisions-are-separate-and-the-provider-for-each-stays-open)); typed checks on both providers ([decision](../../product/decisions.md#2026-11-14-typed-judgements-run-on-both-the-decisions-api-and-jev-and-our-labels-pick)) |
| Live model | talk mode, first and backup per Ben's note |
| AI Search | early product match |
| MLflow 3 | one trace per capture job, the "why?" timeline |

Runs on the phone: gates, pose coverage at 5 Hz, depth, mask, text, barcode, mode pick, EXIF strip, redaction, drag-to-adjust. Runs in the cloud: category, flaws, grouping, product match, talk model.

**Privacy of what the camera sees** ([privacy-and-data.md](../../research/cross-cutting/nate/privacy-and-data.md)): strip GPS and embedded depth from files before upload; blur faces, mail, house numbers and screens on the phone; keep no room mesh or floor plan; send outside providers the masked item crop, not the room; a private room capture is never routed to another provider just because a path exists.

## Contract for the frontend

| Call | Body | Returns |
|---|---|---|
| `POST /v1/captures` | `{item_id?, mode, device:{model, has_lidar, os}}` | `{capture_id, item_id}` |
| `POST /v1/captures/:id/photos` | `{role, gates_passed, pose, has_depth}` | `{photo_id, upload_url}` |
| `PATCH /v1/captures/:id` | `{mode}` | capture |
| `POST /v1/captures/:id/finish` | `{intent: sell, worth, find}` | job `capture_judge` |
| `POST /v1/folders` | `{photo_ids[]}` | job `folder_group` |
| `POST /v1/items/:id/anchors` | `{kind: link or receipt, url?, photo_id?}` | provenance value, `confirmed:false` |

`capture_judge` stages: `received, judged, flaws, measured`, each with `started, running, arrived, failed`. Coverage: `{bins:[12 azimuth x 3 elevation], covered_pct, needs_view?}`. Decisions use the frame's shape; `clarify` options are short answers or a measurement tap.

## Who may act

| Action | Mode |
|---|---|
| Auto-shutter, auto-keep with undo, upload to our volume | auto |
| Send the masked crop to a vision provider | auto |
| Start talk mode (audio and video to a live model) | the person's tap, each session |
| Send an unmasked frame of a room outside | never |
| Store a room mesh | never |

No outward marketplace action happens here.

## How it fails

| Failure | The person sees | Recovery |
|---|---|---|
| No network | nothing changes; a small upload count | queue, retry with the same idempotency key |
| Wrong list picked | the other list one tap away | shots carry over |
| Object Capture crashes (iPhone 17 Pro, iOS 26.4.2 and 26.5, [measure plan](../../research/measure/ben/build-plan.md)) | scan continues | one-frame LiDAR box, then pose coverage |
| Mirror, glass, black fleece | depth ignored there | value shows as estimated (adaptive-capture §1, §9) |
| Blurry or dark after 2 retakes | shot kept with a flag | flaw review asks |
| Wifi drops in talk mode | guided list in under 1 s | after-pass on the recording ([live-video-capture.md](../../research/capture/ben/live-video-capture.md) §6) |
| Face or two items in view | "One item at a time" | continue when clear |

## How we will know it works

| Claim | Check |
|---|---|
| Both paths work on real items | adaptive-capture §10: 30 tape-measured items, 5 per class, a LiDAR and a non-LiDAR iPhone, fixed list against free walk with at most 2 prompts, two naive operators, blind scoring, the failing set included |
| Gates are fair | false reject under 10%, false accept under 5% (Ben's §6) |
| Flaws are found | flaw recall at least 0.7 on the same items |
| Folders group | grouping F1 at least 0.9 |
| It is quick | a top in under 90 s |
| The mode pick is right | provisional pick against the confirmed category on every test item |
| Extra views earn their place | each prompt's field changed band, read from events |

## Facts that constrain it

| Fact | Source |
|---|---|
| Depth 256x192, 20 cm to 2 m, confident wrong returns on mirrors | adaptive-capture §1 (*sourced*) |
| Object Capture needs LiDAR and iOS 17+ | adaptive-capture §2 (*sourced*) |
| Without LiDAR no 1 cm scale from one photo | adaptive-capture §4 |
| Per-class depth quality | adaptive-capture §9 (*inferred*) |
| Live video session limit | [live-video-capture.md](../../research/capture/ben/live-video-capture.md) §10 |
| Marketplace EXIF stripping undocumented; background never stripped | [privacy-and-data.md](../../research/cross-cutting/nate/privacy-and-data.md) |

All adaptive-capture sections are in [adaptive-capture.md](../../research/capture/nate/adaptive-capture.md).

## Demo path

For Ben and Nate to mark.

## Open for Ben and Nate

1. **Does a rigid item open on the list or straight into the scan?** Joint: "Rigid things and furniture get a move-around scan". Ben: "the camera opens on the guided shot list". Recommendation: open on the list for everything; for rigid items its first step is the scan, so both hold. Depends: the camera layout and the offline pick.
2. **Is the talk recording kept?** Ben's note recommends keeping it privately on the item; Nate's privacy note argues minimal retention. Recommendation: keep only the clips behind each "you said" fact. Depends: storage, deletion, the privacy screen.
3. **How many clarifying questions?** Ben: "the user has to do no thinking at all". Nate: ask by useful uncertainty per unit of effort. Recommendation: at most 2 per item, each one tap or one measurement. Depends: the review screen.
4. **What does the real-item test gate?** The decision says both paths are tested before either is final. Recommendation: run §10 with Ben's proof targets as its scores, before the camera screen is called final. Depends: what ＋ ships with.
5. **Stumbles in Ben's design.** Category chips at confidence under 0.6 appear before anything is framed (show them after the first still); the 6-shot cap can drop a second flaw (flaws outside the cap); the white sheet and the 10 s spin read as required (offer them, do not ask); a recap that re-asks what was heard (show only what changes fields). Unused by his design: pose coverage, depth confidence on the mask, the early product match, past labels.
6. **Business.** Receipts, links and measured capture data could carry value (resale proof, paid data); not chosen here.

## Needs from the shared model

- `capture.mode` values and the coverage shape above; `cap_` and `ph_` id prefixes.
- Decision kinds retake, category_unsure, missing_shot, confirm_flaw, approve_groups, clarify.
- Sub-stages of `capturing`: framing, shooting, uploading, judging.
- An identity-anchor entity (link or receipt) or a rule that it is an `attribute` evidence item.
- Mapping Ben's provenance words to the six sources (tag to `label`, his estimated to `inferred`).
- Capture events in [events.json](../../spec/events.json): started, mode_picked, shot_kept, view_asked, talk_started, talk_fell_back, uploaded, finished.
