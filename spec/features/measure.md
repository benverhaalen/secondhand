# Measure
Status: draft, *agent proposal* except where a line links a decision. Slug: measure. Written 2026-11-14.

Today a seller lays a tape on a shirt, writes four numbers on a scrap of paper, and still gets "what are the measurements?" from buyers; a furniture seller guesses whether the dresser fits a hatchback. Measure takes the numbers from the photos capture already took, says how sure it is, and lets the person fix a point with one drag. "Measuring comes first for clothes" (Ben, [vision](../../product/vision.md)); "for clothes measuring the mechanism is measuring more than anything" (Ben, [words](../../product/words.md#2026-11-14-tools-and-capture)).

## What the person does and sees

Measure has no tab of its own. It runs after [capture](capture.md) and shows on the item card in Sell (and in Buy for an item found or wanted).

| Step | The person | The app |
|---|---|---|
| 1 | Finishes capture. | Lines appear on the flat-lay or the scan, each with a value, "± 1 cm" and a word: measured, estimated or you said ([copy.md](../../product/copy.md)). |
| 2 | Looks. | A primary number that is unsure shows a loupe on its endpoint. |
| 3 | Drags an endpoint, or types a tape reading. | Drag recomputes on the phone; a typed number becomes you said. |
| 4 | Taps Looks right. | Every shown value is `confirmed`. |
| 5 | Sees "Fits like M" when a brand chart exists. | Shown as estimated, with the chart named. |

## What it reads and writes

Reads the `capture` and its `photo` rows (pose, depth, depth confidence, mask, read text), the `product` match and its published dimensions.

Writes one `attribute` per measurement, using Ben's shapes from [the measure plan](../../research/measure/ben/build-plan.md): `measurements[]`, `scale`, `dimensions`, `fits_like`. Each carries `plus_minus_mm`. Source mapping: a scale path with a cross-check is `measured`; a size from a tag is `label`; one path only, monocular depth or a model is `inferred`; a published spec is `spec`; a tape reading the person types is `you_said` and is never overwritten.

**Per item class**

| Class | Measured | Path, in order | Fails to |
|---|---|---|---|
| Tops, outerwear, dresses | pit to pit, length (primary); shoulder, sleeve (secondary) | plane scale, card, known length, none; mask and points ([measuring-garments.md](../../research/measure/ben/measuring-garments.md)) | estimated, then a clarify "Measure between these two points" |
| Pants, skirts | waist, inseam (primary); rise, thigh, leg opening | same | same |
| Shoes | outsole length and width; size from the tag | LiDAR box, then Object Capture bounds | tag size alone (`label`) |
| Bags | L, W, H; strap drop | LiDAR box, Object Capture | two taps on a photo with scale |
| Rigid things, electronics | L, W, H; screen diagonal from the spec | one-frame LiDAR box, Object Capture, two taps ([object-capture.md](../../research/measure/ben/object-capture.md)) | spec dimensions (`spec`) |
| Furniture | W, D, H; seat height where it has one | LiDAR box from the scan | two taps with the floor plane |
| Small rigid under 10 cm | L, W, H | card or known length | you said |

Nate's note marks flat garments weak for LiDAR and small items under 10 cm with no usable depth (adaptive-capture §9, *inferred*). Ben's plan uses the ARKit plane, not object depth, as the garment scale, so the two agree: depth adds little on flat clothes; the plane and a card carry the scale.

## States

Measure moves no item state. It runs as a `measure` job inside `capturing` and `researching`. A primary value below 0.7 confidence raises one `measure_review` decision; the item can still reach `review` with that value shown as estimated.

## Systems underneath

| Piece | Does here |
|---|---|
| Swift module | plane scale, LiDAR box, Object Capture, Vision mask, drag recompute; events to JS only ([log/README.md](../../log/README.md)) |
| Lakeflow job `measure` | mask (Vision plus a cloud segmenter), points (geometric pass plus a pointing model run 3 times), scale cross-check |
| Model gateway | bounded checks on the image path ([decision](../../product/decisions.md#2026-11-14-image-decisions-and-text-decisions-are-separate-and-the-provider-for-each-stays-open)) |
| AI Search | product match whose published dimensions feed the identity check |
| Lakebase | attributes; Delta holds corrections as labels |
| MLflow 3 | the trace behind "why this number" |

## Contract for the frontend

| Call | Returns |
|---|---|
| `GET /v1/items/:id/measurements` | `{measurements[], scale, dimensions, fits_like}` |
| `PATCH /v1/items/:id/measurements/:key` | `{endpoints_px}` or `{value_mm}`; dragging keeps the source, typing sets `you_said` |
| `POST /v1/items/:id/measurements/confirm` | all shown values `confirmed:true` |

Job `measure` stages: `scale, mask, points, check`. Decision kind `measure_review`, options Looks right, Fix it, Type it. Display rounds to 1/4 in or 0.5 cm; `value_mm` keeps the raw number.

## How uncertainty is stated

| Shown | Rule (Ben's plan) |
|---|---|
| "± 1 cm" next to every value | `plus_minus_mm` starts at 10 or 15 mm and is multiplied by 1, 1.5 or 2.5 by scale and point agreement |
| measured | two scale paths agree within 2%, and point spread is at most 1.5 cm |
| estimated | one path, mask IoU under 0.9, or spread over 1.5 cm |
| you said | the person typed it |

No range is hidden behind a single number, and a value outside its budget (±1.3 cm primary, ±2 cm secondary; rigid ±1 cm or 3%) is never shown as measured.

## How measurements feed the rest

| Consumer | What it gets | Rule |
|---|---|---|
| Fit matching (Buy and Sell) | `fits_like`, raw garment measurements | Compare with a want's saved measurements within the combined ±. Ben's plan stops at the brand chart; the backend can also match a buyer's own best-fitting garment, measured the same way. |
| Shipping box | `dimensions` plus class | Add padding, pick the smallest mailer or box, compute billed size ([shipping-and-pickup.md](../../research/sold/nate/shipping-and-pickup.md)); handed to [sold](sold.md). Garment folded size is inferred, no sourced fold rule. Weight is never read from photos: `spec` or `you_said`. |
| Identity checks | `dimensions` against each candidate product's published size | A conflict beyond the combined tolerance rules a candidate out; agreement only keeps it in. |

Geometry rules candidates in or out. It never proves authenticity, function or condition: a scan does not show internals, weight, battery or working state (Nate, research session), and the word "authentic" is never written ([identify plan](../../research/identify/ben/build-plan.md)).

## Who may act

| Action | Mode |
|---|---|
| Compute and show measurements | auto |
| Put measured values into a listing draft | auto, shown with their word |
| Overwrite a you said value | never |
| State a box size to a buyer or site | through [sold](sold.md), inside its limits |

## How it fails

| Failure | The person sees | Recovery |
|---|---|---|
| No scale path | numbers as estimated, a card prompt | lay a card, or type it |
| Paths disagree over 2% | estimated, loupe on the worst point | drag or retake |
| Mask unsure (dark garment on a dark floor) | outline shown to adjust | drag the outline |
| Object Capture fails (iPhone 17 Pro, iOS 26.4.2 and 26.5) | box from one frame | two taps |
| Mirror or glass | that face estimated | type it |

## How we will know it works

| Claim | Check |
|---|---|
| Within budget | tape against app on the adaptive-capture §10 set, per class and device; primary within ±1.3 cm on at least 90% (*agent proposal*) |
| The ± is honest | the tape value falls inside the shown ± at least 90% of the time |
| Corrections fall | drag and type rates per class, from events, week on week |
| Boxes fit | the chosen box against what the seller shipped in |
| Identity checks do not reject the right product | zero true products ruled out on the test set |

## Facts that constrain it

| Fact | Sources |
|---|---|
| LiDAR about ±1 cm above 10 cm, 20 cm to 2 m (*sourced*) | adaptive-capture §1 |
| Without LiDAR, no 1 cm scale from monocular depth; Ben's plan puts it at 12% off at best, and Size AI's 5 mm with LiDAR and 9 mm without is *asserted* | adaptive-capture §4, [measure plan](../../research/measure/ben/build-plan.md) |
| USPS billed size, padding, carrier and site size limits | [shipping-and-pickup.md](../../research/sold/nate/shipping-and-pickup.md) |

Sections cited are in [adaptive-capture.md](../../research/capture/nate/adaptive-capture.md).

## Demo path

For Ben and Nate to mark.

## Open for Ben and Nate

1. **3D for clothes?** Ben's measure research rejected single-image 3D for clothes for lacking metric scale ([measure plan](../../research/measure/ben/build-plan.md)); his pipeline note reinstates it, scaled to the measured lengths and labelled as a model ([seeing-the-item-pipeline.md](../../research/cross-cutting/ben/seeing-the-item-pipeline.md)), in line with [it's a demo, so build it](../../product/decisions.md#2026-11-14-its-a-demo-so-build-it). Recommendation: build it, show it as a model, never source a number from it. Depends: the spin shot and the item card.
2. **How wide is "Fits like"?** Ben recommends about 10 hand-picked brand charts. Recommendation: those charts plus matching against the buyer's own garment. Depends: Buy matching and the want shape.
3. **Who sees the ±?** Recommendation: the seller always; buyers see the listing's rounded value with the word. Depends: listing copy.
4. **Business.** Measured, confirmed sizes per product could be a paid data set or a fit service; not chosen here.

## Needs from the shared model

- A measurement attribute that carries `plus_minus_mm`, `endpoints_px`, `photo_id` and `method` beyond the frame's provenance value.
- A `package` hand-off to sold: `{l_in, w_in, h_in, padding_in, weight_oz?, basis}`.
- A want field for the buyer's own garment measurements.
- Decision kind `measure_review` and job kind `measure` with the stages above.
