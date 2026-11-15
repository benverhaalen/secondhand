# Studio photos
Status: draft, second pass. Everything here is *agent proposal* except where a line links a decision or a quote. Slug: studio. Names follow [product.md](../product.md). Written 2026-11-14.

Rule it follows: Ben, "it shouldnt change the environment or lie. it should touch up" ([words](../../product/words.md#2026-11-14-photos-touch-up-never-change-the-environment)). Studio makes the person's own photos look better. It never makes a different photo.

Design in one line: redraw each real photo in place with better light and true color (Seedream seeds plus Nano Banana 2.1), check every candidate against the real photo, rank them, and let the person approve. This is Ben's built route ([packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md): "The gate ranks several candidates ... it no longer blocks"). The check blocks only a vanished flaw or changed tag text; the pixel rule per level is in "The check".

## What the person does and sees
Lives in the item's review step, after capture, before listing. Studio works on the real frames the capture session picked ([scan-to-images](../../research/capture/nate/scan-to-images.md) section e), never on new shots. It never blocks the item state ([product.md](../product.md) item states).

1. The real photos show at once and are usable straight away. A strip of stages shows the work.
2. Each photo has an improved version beside it with a before/after slider, and a pick of level: true color, light or pressed (see "What an edit may and may not do"). The framing, the floor, the wall or the bed stay the same place.
3. One line per photo says what changed: "straightened", "color set to the tag", "light evened", "lint removed". Each line passes a `claim_check` against the edit record, so nothing is claimed that was not done.
4. Chips mark what was kept: logo, tag, each flaw. Tapping one shows original and result side by side.
5. A choice per photo, as on Ben's approval card ([packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md): "Use / Redo / Fix texture / Use real photo"): **Use**, **Redo**, **Fix texture**, **Use real photo**. A re-lay of a badly laid garment is one more option on the card ([words](../../product/words.md#2026-11-14-re-lay-iron-and-audit-the-measurements)). The real photo is one tap away and never deleted.
6. Flaw photos and close-ups are never touched. They go in the listing as shot.
7. If a check blocked the result, it is not offered. The person sees the real photo and a short reason.
8. At listing, any photo still improving is posted as the real one (`kept_real`). Listing never waits.

## What an edit may and may not do
| Allowed | Never |
|---|---|
| Crop, straighten, rotate upright | Hide wear, fading, stains, pilling, scuffs, damage |
| Exposure and white balance toward the true color (the surround and the whole frame, scored against the tag) | Change the item's color or material look |
| At level 2 (pressed): relax storage creases and remove loose lint, as a steamer and lint roller would, with each confirmed flaw box protected | Relax or remove anything inside a confirmed flaw box |
| Clean the surround: remove a stray cord or lint, even out the wall or floor, soften a harsh shadow | Change the environment, add a scene, restage, add a pose nobody photographed |
| Redact private information (a name, an address, a face) | Invent parts, accessories or completeness; add text, badges or watermarks |

Three levels, each a tap on the approval card: 0 true color (white balance and exposure only, no model), 1 light (even soft daylight, neutral color), 2 pressed (level 1 plus creases relaxed and lint gone). Ben settled level 2: "flattening is allowed" ([packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md), [words](../../product/words.md#2026-11-14-garment-templates-a-reference-set-and-reading-c2pa), [words](../../product/words.md#2026-11-14-re-lay-iron-and-audit-the-measurements)). Scene presets and restaging are dropped ([packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md), "Changed 21:28 UTC"). Tag, label, serial and flaw photos stay at level 0 everywhere. Nate's list agrees: cropping, cleanup, exposure that preserves appearance and redaction are fine; hiding wear, changing color, inventing accessories and misrepresenting completeness are not ([trust and returns](../../research/sold/nate/trust-returns-disputes.md) section 5).

## Retouch chosen by the person
*agent proposal*, from Nate: "make retouch a user select feature during the process of creating the listings. They either can generate, where they are informed its going to be tagged ai, or they can choose to provide further images" ([words](../../product/words.md#2026-11-14-nate-the-best-way-to-take-every-photo-tags-delayed-retouch-chosen-by-the-person)).

1. **Default.** During listing creation every photo is the original (`use: real`). Nothing is redrawn until the person asks.
2. **Where the choice sits.** On the photos step of listing creation, after capture has kept its frames and before the per-site preview. One row under the photo strip: **Generate** and **Add photos**. It applies to the item; the person can then change any single photo on its approval card.
3. **Generate.** Before the first tap goes through, one line says these photos will be marked as AI in the app. Which route runs, and how many candidates, follows [capture-shots card 9](../determinations/capture-shots.md#9-which-retouch-route-runs-for-a-photo). The menu is Ben's levels 0 true color, 1 light, 2 pressed, plus re-lay for a badly laid garment (above). Tag, label, serial and flaw photos are never offered and never touched. Each result runs the same check ("The check") and lands on the approval card with Use, Redo, Fix texture and Use real photo.
4. **Add photos.** Opens capture on the same item with the shot list ([capture-shots](../determinations/capture-shots.md#default-plans-by-kind)); the new photos are real and join the strip in card 21's order.
5. **Evidence, either way.** The choice is a `studio_approve` decision with its option. Generate writes the render record (edit list, mask, check numbers, seed, model) with `parent_photo_ids[]` pointing at the original, and marks the photo as AI-made in the app. Add photos records each new photo's role and its capture session. The original is kept in both cases.
6. **Two separate marks.** The in-app AI mark lives in our record and is shown in the app. Whether anything is written into or onto the exported file is a separate setting, so this flow works under either answer to Open 5.

## Design choices
| Choice | Options considered | Picked | Why | What would change it |
|---|---|---|---|---|
| How the item stays real | whole-image redraw by Seedream or Nano Banana ([editing-alternatives](../../research/studio/nate/editing-alternatives.md) sections 3, 5; [seedream](../../research/studio/ben/seedream-relighting.md)); instruction editor with no mask; mask edit (Flux Fill, gpt-image); cut-out plus paste-back | Ben's route: redraw in place, rank several candidates, repair flagged tiles with the real pixels, gate again ([packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md)) | Built and tested on Ben's real photos: alignment 0.93 to 0.99, background agreement 0.89 to 0.94 (*observed*). Cut-out plus paste-back keeps pixels by construction but cannot press creases, so it stays a bake-off candidate | The bake-off below: a route that passes the per-level check and looks better |
| Who makes the mask (for the masked repair and the protected boxes) | SAM 3, BiRefNet (MIT), InSPyReNet (MIT), BRIA (non-commercial weights), Photoroom cut-out ([editing-alternatives](../../research/studio/nate/editing-alternatives.md) sections 1, 7; [scan-to-images](../../research/capture/nate/scan-to-images.md) section f) | BiRefNet first, SAM 3 on edge failures (SAM 3 hosted through fal or Roboflow, as in [capture](capture.md)) | Open, cheap, no per-call price; SAM 3 reported mask AP 48.8 against 38.5 (*asserted*) | Edge errors on glass, fur or hair on the 20-item test |
| What fills the surround | deterministic tidy (blur, shadow lift, no model); Photoroom `ai.soft` shadow; Seedream or IC-Light background relight | Deterministic first (level 0); levels 1 and 2 use the model redraw, and the background check keeps the surround the person shot on | Ben's no-model tweaks already score photos ([photo-score](../../research/studio/ben/photo-score.md)); relight models change foreground values by design | The test shows people prefer model surrounds and the background check holds |
| Does the check block or rank | block every miss; rank and explain only | Block only when a flaw vanished or the tag text changed; rank and explain the rest, with the pixel rule per level below | Those two are the lies; a pressed level changes item pixels by design, so a byte-for-byte block would stop every pressed photo | Thresholds scored against people (below) |
| Is relaxing creases a touch-up | offer a "pressed" level; never | Offer it as level 2, a separate pick, flaw boxes protected | Ben: "it shouldnt change anything in reality except maybe how things are flattened etc" ([words](../../product/words.md#2026-11-14-garment-templates-a-reference-set-and-reading-c2pa)); level 2 settled ([packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md)) | Ben changes it; the returns concern is under Open |
| How many photos | polish few; show many real | Real frames count first, polish second | Photo count matters far more than quality on resale; quality odds ratios are 1.17 to 1.25 ([classifiers](../../research/price/nate/quality-and-value-classifiers.md) section 3) | A sell-through test on a person's own listings |
| Presets (studio, garage, house) | offer; drop | Dropped | Ben: "Scene presets and restaging are dropped" ([packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md), decided) | Ben |

## Data flow
```mermaid
flowchart LR
  A["Lakebase photo: frames picked by capture"] -->|"FastAPI on Apps starts job studio"| B["Lakeflow worker: BiRefNet mask, color.py"]
  B -->|"level 1 and 2 redraw candidates via harness"| C["Unity Catalog volume: render file"]
  C -->|"gate: color, structure, boxes, OCR; plain code"| D["Lakebase photo (use improved), event studio.render_checked"]
  D -->|"MLflow 3 trace, claim_check on edit lines"| E["Lakebase decision studio_approve"]
  E -->|"POST /v1/decisions/:id/act"| F["Lakebase photo use, Delta label row"]
```
Consistent with [product.md](../product.md) section 10: ids are logged, never image content or tag text.

## What it reads and writes
| Entity | Reads | Writes |
|---|---|---|
| `capture`, `photo` | the frames capture chose, tag shot, close-ups, confirmed flaw boxes | a new `photo` (role `studio`, `use` `improved`, `parent_photo_ids` = the original). An original is never changed |
| `attribute` | logo and tag boxes (source `label`), flaws (`you_said`, `measured`) | none. A `you_said` flaw is never overwritten |
| `job` (kind `studio`) | n/a | stages and `result` |
| render record (new) | n/a | per render: source photo id, level, model, seed, edit list, check numbers, outcome, choice, and the model's own content-credential declaration as the file returned it. Exported photos carry no credential and no AI label; studio keeps the declaration here ([words](../../product/words.md#2026-11-14-no-ai-tag-on-exported-photos-track-it-on-our-end)) |
| `event` | n/a | `studio.started`, `studio.render_checked`, `studio.render_failed`, `studio.chosen` |

Proof layer, all *agent proposal*:
- Each render carries `evidence` `{kind: image_region, ref: original photo id, region: the item mask, captured_at, extractor_version}`. It links the result to its original, and the mask is stored as a file.
- Each check number the app shows is a guarded number `{value, basis_count, as_of, citation_id, state, hide_reason}`. The citation names the gate version and the pair of photos, so the number can be recomputed. A number with no calibration (see Open) is `hidden` with `hide_reason: uncalibrated`.
- The "what changed" lines and the reason for a rejection pass a `claim_check` (backed by the edit record). A held line becomes a decision of kind `unbacked_claim`.

Files: originals and renders in a Unity Catalog volume, one folder per item and capture. Render records in a Delta table, the source for retuning thresholds.

## States
| Photo version | Move | Trigger |
|---|---|---|
| `original` | exists from capture | capture |
| `improving` | job starts | capture complete |
| `ready` | no blocking miss | gate |
| `kept_real` | blocked twice, still improving at listing, or the person chose real | gate, listing or person |
| `chosen` | person taps Use improved | decision |

## The check
Each result is compared with its original after alignment, cheapest first ([build-plan 4.4](../../research/studio/ben/build-plan.md)).

| Check | Effect on a miss |
|---|---|
| Item pixel rule by level (table below) | per level |
| Tag text same (OCR diff) | blocks |
| Protected boxes (logos, each flaw) still match | blocks. A vanished flaw is a hard reject, never shown |
| Alignment, color (CIEDE2000), structure per tile | ranks and explains |
| Background matches the original (new check from Ben's rule) | ranks and explains |
| Edge halo around the mask | ranks and explains |
| Image-decision predicates on paired crops, `render_same_item` | ranks; the provider is open ([decisions](../../product/decisions.md), D-L6) |

Item pixel rule by level (*agent proposal*; Ben's route has no pixel block, [packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md)):

| Level | What may differ inside the item | What must match | Effect on a miss |
|---|---|---|---|
| 0 true color | white balance and exposure only | everything else, pixel for pixel after the same transform | ranks; a tweak that moves the item's color is refused ([photo-score](../../research/studio/ben/photo-score.md)) |
| 1 light | light, shadow and neutral color | shape, position, prints, tags, edges, color within the CIEDE2000 bar | ranks and explains |
| 2 pressed | storage creases and loose lint | the same, and every confirmed flaw box unchanged | ranks; a vanished flaw or changed tag text blocks |
| Re-lay (an option) | the layout of the garment | prints and tag text read back against the close-up; width-to-length within 5% of capture's measured ratio | a render more than 5% off is dropped; a render is never used to work out size ([words](../../product/words.md#2026-11-14-re-lay-iron-and-audit-the-measurements)) |

On a block the person is told which photo and why. Thresholds are uncalibrated (three items, six renders: [prototype](../../research/studio/ben/prototype/README.md), [renders](../../research/studio/ben/renders/README.md)).

## Photo order and sites
The evidence photo (true-color real front) is first on every site, then approved renders, then real close-ups and flaws. The `list` feature owns the final order ([list.md](list.md)); studio supplies the set and a per-site default. Account risk shown per site: eBay and Etsy have the strictest photo rules, so the person sees "one real photo stays first" on those two.

## Contract for the frontend
- No studio endpoint of its own: the job `studio` starts when capture completes ([product.md](../product.md) job kinds, item research) and is `{id, kind: "studio", stages, result?}`; stream at `GET /v1/jobs/:id/events` (SSE). Redo is an answer to the decision.
- Stages: `uploaded, color_fixed, rendering, checking, repairing, ready, failed`. States `started, running, arrived, failed`.
- `result`: `[{photo_id, render_id, level, edits, checks: [guarded number], outcome, evidence}]`.
- Decision kind `studio_approve`, options `use_improved`, `use_real`, `redo`, `fix_texture`; `suggested` is `use_improved` only when nothing blocked. Answered at `POST /v1/decisions/:id/act`.
- Errors: `{code, message, failed_step, retry}`.

## Who may act
| Action | Mode |
|---|---|
| Run the improvement job | auto |
| Put an improved photo in a listing | ask; promotable after 3 unedited approvals ([product.md](../product.md) decision kinds); the real evidence photo always stays |
| Redo | auto, within a retry cap |
| Remove a real photo from a listing | locked, person only |

## How it fails
| Failure | Person sees | Recovery |
|---|---|---|
| Blocked result | real photo plus the reason | retry once, repair by blending real pixels back (2 rounds), then keep real |
| Flaw vanished | nothing offered | hard reject, logged |
| No color anchor | "color not checked" | deterministic exposure only |
| Mask fails (glass, fur, thin straps) | slider and a question | person decides |
| Model host down | real photos, job `failed` with `retry` | backoff; listing proceeds with real |

## How we will know it works
| Bar | Source | Check |
|---|---|---|
| Prints, logos and tag text survive the redraw on 20 of 20 items at levels 1 and 2 (the best raw editor kept product detail 28 to 29% of the time, *observed*; the gate and repair must beat it) | [Photoroom benchmark, 2026-07-06](../../research/studio/nate/editing-alternatives.md) section 0; tests flat-lay generation, not cleanup, so it is the nearest published figure, not an equal one | The per-level pixel rule on the 20-item set |
| Alignment 0.93 to 0.99 and background agreement 0.89 to 0.94 held or beaten | Ben's six Seedream 5.0 Pro renders and four touch-ups (*observed*, [packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md)) | Same measures on the 20-item set |
| Photo score: careful photos gain about one point; dimmed copies recover from the mid 70s to about 90 | [packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md) and [photo-score](../../research/studio/ben/photo-score.md) (*observed*; a quality measure, not fitted to sales) | Same on the 20-item set |
| Vanished flaws caught at 95% or better | this spec (*agent proposal*); no published figure | Paint out known flaws on 20 to 30 items |
| Median CIEDE2000 on the item under the bar | [prototype](../../research/studio/ben/prototype/README.md) | Score real photo A against real photo B of the same item to set the bar |
| Bake-off: Seedream, Nano Banana, Flux Fill, Kontext, cut-out plus paste-back, no-model tweaks, same 20 items, judged blind by people | [coverage](../coverage.md) | Decides the surround filler |
| Every render has a record row with the person's choice | this spec | Delta count |

## Facts to know
| Fact | Mark | For a public launch |
|---|---|---|
| eBay bans photos that misrepresent the item; no text, border or watermark; 500 px minimum ([build-plan](../../research/studio/ben/build-plan.md)) | observed | the same rule applies; the per-site note stays on the card |
| eBay has no published AI disclosure rule and allows AI-edited photos, but expects real photos of used goods ([trust and returns](../../research/sold/nate/trust-returns-disputes.md) section 5) | asserted, secondary | re-check the policy page, text unopened |
| Etsy wants one unaltered photo of the real item ([build-plan](../../research/studio/ben/build-plan.md)) | asserted, page unopened | open the page; the first-photo rule already covers it |
| Depop: use photos you took yourself; sources disagree on generated images. Poshmark, Mercari, Facebook: no official rule found ([trust and returns](../../research/sold/nate/trust-returns-disputes.md) section 5) | asserted | confirm each before enforcement; Ben's platform notes may cover them |
| Seedream renders carry a C2PA manifest saying "made by an AI model", signed by BytePlus; a crop or JPEG re-save drops it ([packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md), "Added 23:20 UTC") | observed | Ben: no credential and no AI label on exported photos ([words](../../product/words.md#2026-11-14-no-ai-tag-on-exported-photos-track-it-on-our-end)). Re-check each site's rule on AI-edited photos before a public launch |
| Gemini output carries a SynthID watermark ([editing-alternatives](../../research/studio/nate/editing-alternatives.md) section 5) | observed | none; a challenger would add an invisible mark |
| Seedream 5.5 has not been run; no host offers a mask for it; `watermark` defaults to true, send false ([seedream](../../research/studio/ben/seedream-relighting.md)) | observed | none |
| Weights licences: BiRefNet, InSPyReNet MIT; IC-Light Apache-2.0; BRIA RMBG-2.0 non-commercial ([editing-alternatives](../../research/studio/nate/editing-alternatives.md) section 7) | observed | BRIA needs a commercial licence; the others pass |
| An edited photo that looks better than the item can make a normal sale a not-as-described case ([trust and returns](../../research/sold/nate/trust-returns-disputes.md)) | inferred | same |

Rules that protect people still hold: private details are redacted, not shared; a recalled product is not listed.

## Open for Ben and Nate
1. **A "styled" mark inside the app.** Ben decided exported photos carry no AI label ([words](../../product/words.md#2026-11-14-no-ai-tag-on-exported-photos-track-it-on-our-end)). Does any in-app surface still show that a photo was improved, such as the "styled" badge in [seedream-relighting](../../research/studio/ben/seedream-relighting.md), and who sees it, the seller only or buyers too?
2. **Per-site default level.** Ben's platform notes give level 1 on eBay, Depop, Poshmark and Mercari and level 0 on Facebook, OfferUp and Grailed ([packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md); [list](list.md)). Are these canon?
3. **Pressed level and returns.** Ben allows level 2 flattening ([words](../../product/words.md#2026-11-14-garment-templates-a-reference-set-and-reading-c2pa)). The research note on returns lists hiding wear as never allowed ([trust and returns](../../research/sold/nate/trust-returns-disputes.md) section 5). Does pressed stay off by default on any site or condition grade?
4. **Cost.** Per-render model calls are paid; free, included or paid is a business choice. Nate: "Studio cost will be calculated optimally." ([words](../../product/words.md#2026-11-14-nate-the-search-engine-is-an-api-no-feeds-no-tax-service-tags-on-retouched-photos)). Which route runs for a photo is decided by expected gain against cost, with no fixed budget ([capture-shots card 9](../determinations/capture-shots.md#9-which-retouch-route-runs-for-a-photo), *agent proposal*).
5. **Is anything written into or onto an exported photo?** Ben: "dont say it was made with ai. track on our end but for demo purposes we want it to just work before tinkering. worst case scenario is everything works beautifully but we cant post because we added an ai tag." ([words](../../product/words.md#2026-11-14-no-ai-tag-on-exported-photos-track-it-on-our-end)). Nate, newer: "Ai tags on photos retouched, but not on ones taken." ([words](../../product/words.md#2026-11-14-nate-the-search-engine-is-an-api-no-feeds-no-tax-service-tags-on-retouched-photos)), after his earlier "They either can generate, where they are informed its going to be tagged ai" ([words](../../product/words.md#2026-11-14-nate-the-best-way-to-take-every-photo-tags-delayed-retouch-chosen-by-the-person)). So Nate: a photo a model retouched carries an AI tag and a photo the person took never does; Ben: no AI tag on exported photos, tracked on our side. Not resolved here; "Retouch chosen by the person" keeps the in-app mark apart from the file.
6. **Does retouch run by default per site, or only when the person picks it?** Ben's notes set a default level per site ([packet 31](../../.agents/team/packets/list/31-platform-fit.md), [packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md); Open 2). Nate: "make retouch a user select feature during the process of creating the listings" ([words](../../product/words.md#2026-11-14-nate-the-best-way-to-take-every-photo-tags-delayed-retouch-chosen-by-the-person)). Not resolved here.

Decided, with the source: no scene presets ([packet 30](../../.agents/team/packets/studio/30-studio-build-plan.md)), no AI label on exported photos ([words](../../product/words.md#2026-11-14-no-ai-tag-on-exported-photos-track-it-on-our-end)), level 2 flattening allowed, and the gate ranks redraws instead of blocking on a changed item pixel.

## Needs from the shared model
- A render record (or fields on `photo`) with edit list, mask ref, check numbers, seed, model and choice.
- The `studio` job kind, the `studio_approve` kind (with the added option `fix_texture`) and `studio.*` events in [product.md](../product.md).
- A photo-order-per-site table owned by `list`.
- Links to `market.md` and `score.md` once they exist, for photo count as a score axis.
