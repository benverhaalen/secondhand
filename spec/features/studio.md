# Studio photos
Status: draft, *agent proposal* except where a line links a decision. Slug: studio. Written 2026-11-14.

Rule it follows: Ben, "it shouldnt change the environment or lie. it should touch up" ([words](../../product/words.md#2026-11-14-photos-touch-up-never-change-the-environment)). Studio makes the person's own photos look better. It never makes a different photo.

## What the person does and sees
Lives in the item's review step, after capture, before listing. The person takes no extra step to start it.

1. The real photos show at once, usable straight away. A strip of stages under them shows the work (see Contract).
2. Each photo gets an improved version beside it, with a before/after slider. The same floor, wall or bed stays; the frame, folds, prints and tags stay.
3. A line per photo says what changed in plain words: "straightened", "light evened", "color set to the tag", "background tidied". Nothing is claimed that was not done.
4. Chips mark what was kept: logo, tag, each flaw. Tapping one shows the original and the result side by side.
5. A choice per photo: **Use improved**, **Use real**, **Redo**. The real photo is always one tap away and is never deleted.
6. Flaw photos and close-ups are never replaced. They go in the listing as shot.
7. If a check failed, the improved version is not offered. The person sees the real photo and a short reason ("the result changed the tag, so we kept yours").

## What an edit may and may not do
| Allowed | Never |
|---|---|
| Crop, straighten, rotate upright | Hide wear, fading, stains, pilling, scuffs, damage |
| Exposure and white balance toward the true color | Change color or material look |
| Background cleanup inside the rule: remove a stray cord or lint, keep the surface and place | Change the environment, add a scene, restage, or add a pose nobody photographed |
| Redact private information (a name, an address, a face) | Invent parts, accessories or completeness |
| Relax storage creases only if the person picks that level (Open) | Add text, badges or watermarks in the pixels |

Nate's list is the same: cropping, background cleanup, exposure that preserves appearance and redaction are fine; hiding wear, changing color, inventing accessories and misrepresenting completeness are not (Nate's session, see also [trust and returns](../../research/sold/nate/trust-returns-disputes.md)).

Levels the person can pick (Ben's build plan, *agent proposal*): true color (deterministic, no model, always made first), light (even soft light, lifted shadows), pressed (light plus relaxed creases). See [build-plan](../../research/studio/ben/build-plan.md).

## What it reads and writes
| Entity | Reads | Writes |
|---|---|---|
| `capture`, `photo` | originals, tag shot, close-ups, defect boxes the person confirmed | never changes an original |
| `attribute` | logo and tag boxes (source `label`), flaws (`you_said`, `measured`) | none; a `you_said` flaw is never overwritten |
| `job` (kind `studio`) | n/a | stages, result: list of renders |
| render record (new, see Needs) | n/a | per render: source photo id, level, model, seed, edit list, each check's number, outcome, person's choice |
| `event` | n/a | `studio.started`, `studio.render_checked`, `studio.render_failed`, `studio.chosen` (actor `user` or `auto`) |

Files: originals and renders in a Unity Catalog volume, one folder per item and capture; original keeps its path, renders get a new id. Per-render records are a Delta table (the gate numbers and the choice), the source for retuning thresholds. Log ids only, never image content or tag text ([logging](../README.md)).

## States
| Photo version | Move | Trigger |
|---|---|---|
| `original` | exists from upload | capture |
| `improving` | job starts | capture complete |
| `ready` | check passed | gate pass |
| `kept_real` | check failed twice, or person chose real | gate or person |
| `chosen` | person taps Use improved | decision |

The item state does not move because of studio. Listing needs every photo to be `chosen` or `kept_real`.

## Systems underneath
| Piece | Role here |
|---|---|
| Expo app | shows stages, slider, chips, choice |
| FastAPI on Databricks Apps | starts the job, streams events, writes records |
| Lakeflow job or worker | runs prepare, render, check, repair |
| Unity Catalog volume | originals and renders |
| Delta | render records, labels |
| MLflow 3 | trace per job, shown as "why?" |
| Seedream 5.5 (BytePlus), Nano Banana 2.1 as challenger | the touch-up render; OpenRouter as fallback host |
| Model gateway, Decisions API and Jev | predicates on paired crops, typed judgements per [decision](../../product/decisions.md) |

Pipeline (Ben's, *agent proposal*): prepare (segment, color correct, protect boxes), render (several candidates), check, repair (blend real pixels back into a flagged box, at most 2 rounds), then the person decides. Fallback when two renders fail: the deterministic true-color photo or the real one.

## The check
Each result is compared with its original after alignment. Order, cheapest first ([build-plan 4.4](../../research/studio/ben/build-plan.md)):

| Check | Fails when |
|---|---|
| Alignment | the frame moved or was redrawn |
| Color (CIEDE2000) | the item's color drifted beyond the bar |
| Structure per tile | seams, prints or folds changed |
| Protected boxes (logos, tag, each flaw) | any box no longer matches |
| Background matches the original | the environment changed (the new check from Ben's rule) |
| OCR diff on the tag | letters changed |
| Decisions predicates on paired crops | `render_same_item`, `render_preserves_defect_i` below the bar |

On failure: a flaw box that vanished is a hard reject and the result is never shown. Other failures retry once with a new seed, then repair, then fall back to the real photo. The person is told which photo and why, never silently. Thresholds are uncalibrated (three items, six renders).

## Photo order per site
The evidence photo (the true-color real front) is first on every site. Then approved improved photos, then the real close-ups and flaw photos. Per-site rules ([build-plan, eBay and Etsy](../../research/studio/ben/build-plan.md)):

| Site | Rule | Mark |
|---|---|---|
| eBay | no photo that misrepresents the item; no text, border or watermark; 500 px minimum | observed |
| Etsy | one unaltered photo of the real item on a real background | asserted, page unopened |
| Depop, Poshmark, Mercari, Facebook | not researched here | unknown |

The `list` feature owns the final order; studio supplies the ranked set and a per-site default level.

## Contract for the frontend
- `POST /v1/items/:id/studio` returns a job `{id, kind: "studio", stages, result?}`.
- Stages in order: `uploaded, color_fixed, rendering (photo n of m), checking, repairing (box), ready, failed (reason, real photo kept)`. Stage states `started, running, arrived, failed`. Stream at `GET /v1/jobs/:id/events`.
- `result`: `[{photo_id, render_id, level, edits:[string], checks:[{name, ok}], outcome, original_url, render_url}]`.
- Decision kind `studio_approve`: options `use_improved`, `use_real`, `redo`; `suggested` is `use_improved` only when every check passed.
- Errors: `{code, message, failed_step, retry}`.

## Who may act
| Action | Mode |
|---|---|
| Run the improvement job | auto |
| Put an improved photo in a listing | ask. Not offered to "Always do this" until 3 unedited approvals; the real evidence photo always stays |
| Redo | auto, within a retry cap |
| Remove a real photo from a listing | locked, person only |

## How it fails
| Failure | Person sees | Recovery |
|---|---|---|
| Render fails check | real photo plus the reason | retry, repair, then keep real |
| Flaw vanished | nothing offered | hard reject, logged |
| No color anchor (no tag or card) | "color not checked" on the card | deterministic exposure only |
| Model host down or rate limited | real photos, job `failed` with `retry` | backoff; listing never waits |
| Dark or plain item (too few features to align) | slider and a question | person decides |

## How we will know it works
| Claim | Check |
|---|---|
| No flaw is ever hidden | seed known flaws painted out on 20 to 30 of the team's items; gate catches at least 95% |
| Color stays true | median CIEDE2000 under the bar on the item, scored against the real photo |
| The person sees the choice | every render has a record row with the person's choice |
| Honest variation is known | score real photo A against real photo B of the same item to set the bars |

## Facts that constrain it
- eBay picture policy, Etsy unaltered-photo rule: [build-plan](../../research/studio/ben/build-plan.md), marks above.
- Seedream 5.5 has not been run yet; no host offers a mask (observed on 5 hosts): [build-plan](../../research/studio/ben/build-plan.md).
- Seedream `watermark` defaults to true; always send false (observed).
- Photoroom: raw editing models keep product detail only 28 to 29% of the time (observed), so a failing check is normal, not rare.

## Demo path
For Ben and Nate to mark.

## Open for Ben and Nate
1. **Presets versus touch-up only.** Earlier, Ben: "the user can choose to light it in a studio, in a garage, in a house" ([words](../../product/words.md#2026-11-14-tools-and-capture)). Newest, Ben: "it shouldnt change the environment or lie. it should touch up" ([words](../../product/words.md#2026-11-14-photos-touch-up-never-change-the-environment)). This spec follows the newest: no scenes, no restaging. Recommendation: drop studio, garage and house; offer the three levels (true color, light, pressed). A restage as a labelled "styled" extra would break the newest line, so it is left out unless Ben says otherwise. Depends on: the whole approval card.
2. **Is relaxing creases ("pressed") a touch-up or hiding wear?** Ben's build plan leaves it to Ben. Nate's list says never hide wear. Recommendation: offer it only as a separate pick, with flaw boxes protected, off by default.
3. **Rank or block.** Ben's plan says the gate ranks and explains and the person decides; the check table above rejects. Recommendation: block when a flaw vanished or the tag changed, rank otherwise. Thresholds need calibration on the team's items first.
4. Does the "styled" label appear in the app when an improved photo is used? Etsy and eBay want one unaltered photo; recommendation: always label, never in the pixels.
5. Cost: renders cost per call. Whether studio is free, included or paid is a business choice; not decided here.

## Needs from the shared model
- A `photo_version` or `render` entity (or fields on `photo`) with edit list, check results, seed, model and the person's choice.
- A decision kind `studio_approve` and a job kind `studio`.
- An event action vocabulary for studio (`studio.*`).
- A photo-order-per-site table owned by `list`.
- A label table convention: each choice (use improved, use real, redo, "this changed") becomes a row `{render_id, check numbers, choice, edited?}`, with approvals counted toward "Always do this" only when unedited.
