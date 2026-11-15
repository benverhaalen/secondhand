# Determinations: capture shots
Status: *agent proposal* for Ben and Nate. Written 2026-11-14.

This file decides which shots capture asks for, per item kind, in what order, and when it stops asking. It answers Nate: "Determine the best way to capture every photo, for ease of process and amount of information ascertained" ([words](../../product/words.md#2026-11-14-nate-the-best-way-to-take-every-photo-tags-delayed-retouch-chosen-by-the-person)), and his steer that followed: "front, back, maybe also the tag, no side photos but just clothing tag for clothing? for furniture and objects we can do lidar, like shoes, whatever would be instant and intuitive for capturing and creating the listings, with the least amount of additional input" ([words](../../product/words.md#2026-11-14-nate-front-back-and-tag-for-clothes-lidar-for-objects-the-least-extra-input)). It feeds [capture](../features/capture.md) and builds on the capture cards in [seeing-the-item](seeing-the-item.md), which it links rather than restates.

**The measure of a plan.** A plan is better when it reaches the facts a good listing needs in fewer seconds and with less extra input from the person. The person takes a few pictures; the product places them in each site's listing and writes each listing for that site's search. So every shot beyond the default has to earn its seconds, by the rule in [card 3 below](#3-whether-an-extra-shot-is-asked).

**How capture opens.** Ben decided the camera opens on the guided shot list, with talk mode one tap away ([decision](../../product/decisions.md#2026-11-14-capture-opens-on-the-guided-shot-list-talk-mode-is-one-tap-away)). Nate's later words replace the checklist with a type pick: "Now the camera opens on the shot checklist? no. The camera will be pressed, an onboarding tutorial of how to select the product type ... then each has a cpature process, either instant picture, series of pictures with specified frames like clothing tags, scanning for objects" ([words](../../product/words.md#2026-11-14-nate-finalised-the-intelligence-engine-the-listing-swarm-the-buying-engine-and-how-capture-works)). This file follows Nate's flow as the proposal: the person picks the type (suggested from the first frame, so it is one tap), and the plan below for that type is its capture process. The two openings stand side by side under [capture, Open for Ben and Nate](../features/capture.md#open-for-ben-and-nate) until they decide. Talk mode stays one tap away in either. The outline overlay comes from studio's templates ([capture-coaching §6.2](../../research/capture/ben/capture-coaching-and-frames.md)). Every listing photo is one 3:4 frame, 1200x1600, with the item inside a centred square ([card 8](#8-the-one-frame-and-each-sites-crop)).

**Marks.** *observed* or *asserted* lines carry their source. Every number marked "start" is a starting value, to be replaced by the 30-item test in [adaptive-capture §10](../../research/capture/nate/adaptive-capture.md).

## Default plans by kind

Each plan below is the capture process for one of the 14 types in [product.md](../product.md#3-the-data-model) (the `family` values), the type the person picked. A process is built from three step kinds, Nate's three: `instant` (one still, or two of a flat thing's sides), `series` (named frames in order, such as front, back, tag) and `scan` (a move-around for shape and dimensions, then the label still). The "Process" line under each type names its steps; the table gives the frames. Without LiDAR every `scan` step becomes the 8-still ring ([below](#on-a-phone-without-lidar)), so the person makes the same move. What follows the shots (more photos or generated ones, and the type's follow-up inputs) is in [capture](../features/capture.md#what-the-person-does-and-sees).

Seconds are start values for one shot once the item is laid out or in place. Laying a garment out is counted once per item (about 20 s, start). "Settles" names the item-card fields and the determination that reads them. "Becomes" is the listing photo position under [card 21](seeing-the-item.md#21-which-frames-become-listing-photos-and-in-what-order). Every site takes the same frame through its own crop ([card 8](#8-the-one-frame-and-each-sites-crop)); per-site order and photo caps are list's. Each "Asked only when" line is applied through [card 3](#3-whether-an-extra-shot-is-asked); the shot is never part of the default.

### apparel: tops and dresses, trousers, outerwear

Process: `series` front, back, tag. Without LiDAR: the same; nothing here uses depth.

Default: front, back, tag. No side photos (Nate). The tag is in the default, on evidence:
- It settles brand and size in one shot of about 8 s. Depop requires brand and size, Poshmark requires size, and eBay's clothing aspects are size, brand, colour and material (*observed*, [listing-fields §6](../../research/list/nate/listing-fields-by-platform.md)).
- Brand drives search: Poshmark says brand gives more exposure, Mercari that brand improves searchability (*observed*, listing-fields §7).
- Country of origin sits at the inside centre of the neck on a US garment, by law (16 CFR 303, *observed*, [identity-schema §1](../../research/item-card/nate/identity-schema-by-kind.md)).
- Card 3 already ranks the identifier label first because it settles the most fields per shot ([card 3](seeing-the-item.md#3-what-must-still-be-captured-and-when-it-is-enough)).

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Front | Flat on a plain floor or sheet, square-on overhead. Tops at 0.9 to 1.4 m; trousers sideways with the waist on the left at 1.2 to 1.6 m (*observed*, Ben's photos, [capture-coaching §6.1 and §6.3](../../research/capture/ben/capture-coaching-and-frames.md)). Soft daylight, no flash, phone at 1x. The overlay fits when IoU ≥ 0.75, tilt ≤ 5°, centre within 4% (Ben, §6.2). | 5 | kind ([card 1](seeing-the-item.md#1-item-kind)), colour ([card 8](seeing-the-item.md#8-colour)), print and logo for brand ([card 5](seeing-the-item.md#5-brand)), the front's measurements ([card 10](seeing-the-item.md#10-each-measurement)), front flaws ([card 12](seeing-the-item.md#12-each-flaw)) | cover, all sites |
| 2 | Back | Turn it over in place, same distance and outline. | 10 | the back's measurements (card 10), back flaws (card 12), back print | photo 2, all sites |
| 3 | Tag | The neck or waistband label, flat, at 25 to 30 cm, lit from the side to cut glare. Letters need at least 16 px in the full-resolution still, so this is a 12 MP still, never a video frame (*observed*, §5.3). | 8 | brand ([card 5](seeing-the-item.md#5-brand)), size ([card 7](seeing-the-item.md#7-size)), origin and style code ([card 4](seeing-the-item.md#4-text-and-codes-read-from-labels)) | label photo, all sites |

Clothing total: about 23 s of shots plus about 20 s laying out, against Ben's bar of a tee in under 70 s ([capture](../features/capture.md#how-we-will-know-it-works)).

Asked only when:
- **Flaw close-up**, at 20 to 25 cm: card 12 finds a flaw candidate it cannot confirm from the front or back. Condition is a required field on every site.
- **Care label**: material ([card 16](seeing-the-item.md#16-material)) is still unsettled after the tag and a target site has a material field. The care label carries fibre content and RN by law (*observed*, identity-schema §1).
- **Fabric close-up**, at 20 to 25 cm (Ben, §6.3 shot 6): material is unsettled after the care label, or the person chose Generate in [studio](../features/studio.md#retouch-chosen-by-the-person), whose check needs the weave.
- **Print or graphic detail**: the front shows a print card 5 or [card 9](seeing-the-item.md#9-which-product-it-is-and-when-identity-is-confirmed) needs for brand or product.
- **Waistband, hems, back pocket** (trousers; Ben, §6.3): a fit or flaw field is unsettled.
- **Hangtag** (new with tags): the front shows one.
- **Lining, zip pull, hardware** (outerwear): brand or material is unsettled and the hardware carries a mark.
- **Tape on a seam**: [card 11](seeing-the-item.md#11-uncertainty-of-each-measurement) leaves a primary measurement outside its budget.

### shoes

Process: `scan`, then `series` size label, soles. Without LiDAR: the 8-still ring, length by lookup of the identified model.

Default: one move-around scan, then the size label and the soles.

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Scan | The pair on the floor, one ring at 0.9 to 1.5 m in 15 to 30° steps, phone at shoe height, until the coverage ring closes (Polycam guidance, *observed*, [adaptive-capture §5](../../research/capture/nate/adaptive-capture.md)). | 30 | kind, colour, model shape for identity (card 9), upper and midsole flaws (card 12), length (card 10) | cover (side profile), front, back, top, all sites, picked by card 21 |
| 2 | Size label | Inside the tongue or on the insole wall, at 25 to 30 cm. | 8 | size (card 7), style code (card 4) | label photo, all sites |
| 3 | Soles | Lift the pair, soles to the camera, at 40 to 50 cm. The scan from above cannot see them. | 8 | sole wear (card 12) | sole photo, all sites |

Shoe size is mandatory on the sites (*observed*, listing-fields §6), so the label is default. Asked only when: the insole (insole wear unsettled), the box label (the person said there is a box), a flaw close-up (card 12).

### bags

Process: `scan`, then `series` inside tab. Without LiDAR: the 8-still ring, dimensions by lookup, then a card laid beside the bag.

Default: scan, then the inside tab.

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Scan | Bag standing, stuffed to its shape if soft, one ring at 0.9 to 1.5 m. | 30 | kind, colour, shape for identity (card 9), width, height, depth (card 10), outside flaws (card 12) | cover (front), sides, back, all sites |
| 2 | Inside tab | Open the bag, the date code or serial tab at 25 to 30 cm, lit by the phone's light only if the shot fails [card 2](seeing-the-item.md#2-whether-a-frame-is-a-usable-view). | 10 | brand, serial or date code (card 4), inside condition | label photo, all sites |

The serial or date code sits on an interior tab (*observed*, identity-schema §3). Asked only when: the hardware engraving (brand unsettled), corners and handles close (card 12 candidate), strap drop (no scan).

### jewellery_watches: watches and jewellery

Process: `series` front, back or stamp. Without LiDAR: the same; depth is not used.

Under 10 cm and reflective: no scan. Depth is outside its bound and confident but wrong on metal ([adaptive-capture §9](../../research/capture/nate/adaptive-capture.md)).

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Front | Watch dial or piece flat on a matte dark cloth, at 20 to 25 cm (the minimum focus is 15 to 25 cm, §5.2), tilted 10 to 15° so the crystal does not mirror the phone. | 6 | kind, brand on dial (card 5), colour, front flaws | cover, all sites |
| 2 | Back or reference | The case back, or the reference between the lugs; for jewellery the stamp. | 8 | reference and serial (card 4), metal stamp ([card 16](seeing-the-item.md#16-material)) | label photo, all sites |

Reference and serial sit on the case back or between the lugs (*observed*, identity-schema §4). Asked only when: the side with the crown, the clasp, a stamp macro (metal unsettled), a coin in frame for size (no reference to look up the case size).

### electronics: phones and laptops

Process: `series` About screenshot, front with the screen on, back. Without LiDAR: the same.

Screens act as mirrors, so depth is wrong and no scan is used ([adaptive-capture §9](../../research/capture/nate/adaptive-capture.md)). Dimensions come from the identified model by lookup.

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Screenshot of About | On the device itself, Settings > About and battery health, saved and added. Cheaper than asking (*observed* advice, identity-schema §7). | 15 | model, storage, serial or IMEI, battery health (card 4) | never a listing photo; the IMEI is evidence only |
| 2 | Front, screen on | Flat on a matte surface, 30 to 40 cm, tilted 10 to 15° against glare. | 6 | screen condition (card 12), colour | cover, all sites |
| 3 | Back | Turned over, same distance. | 6 | colour, back and camera flaws (card 12) | photo 2, all sites |

Asked only when: the edges and ports (a card 12 candidate), the charger and box (the person said they come with it), a laptop's keyboard (laptops: keyboard wear is a condition field).

### electronics: headphones, cameras, consoles, audio

Process: `scan`, then `series` model plate. Without LiDAR: the 8-still ring, dimensions by lookup.

Default: scan, then the model plate. Glossy plastic weakens depth, so dimensions fall back to lookup when depth confidence is low.

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Scan | One ring at 0.9 to 1.5 m, or the 8-still ring on a phone without LiDAR. | 25 | kind, shape for identity (card 9), dimensions where depth holds (card 10), outside flaws | cover, sides, all sites |
| 2 | Model plate | The label underneath or in the battery bay, at 25 to 30 cm. | 8 | model and serial (card 4) | label photo, all sites |

Asked only when: the screen on (function unsettled), the ports, the accessories laid out ([card 15](seeing-the-item.md#15-completeness)), a short video powering on ([card 6](#6-when-a-scan-or-a-video-replaces-photos)).

### furniture

Process: `scan`. Without LiDAR: the 8-still ring; dimensions by lookup when the maker's model is found, else a typed width, depth and height, the one place a tape is asked, since a coin is too small against a sofa.

Default: one scan, the shot Nate named.

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Scan | Walk around at 1 to 2 m; for a large piece or one against a wall, Area Mode, one side at a time (*observed*, [adaptive-capture §2 and §9](../../research/capture/nate/adaptive-capture.md)). | 40 | kind, style and material for identity, width, depth, height (card 10), flaws | cover (three-quarter view), front, side, all sites |

Asked only when: the maker's label (under the seat or inside a drawer; brand unsettled), a flaw close-up (card 12), a drawer open (condition of the inside unsettled).

### lighting_home: home goods, decor and lighting

Process: `scan`, then `series` base. Without LiDAR: the 8-still ring with a card beside the piece.

Default: scan, then the base or maker's mark. Glass, mirrors and chrome give wrong depth, so for those the plan is the still ring with a reference object ([card 7 below](#7-when-depth-gives-a-measurement-without-a-tape)).

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Scan | One ring at 0.9 to 1.5 m. | 25 | kind, colour, dimensions (card 10), flaws | cover, sides, all sites |
| 2 | Base | Turned over, the maker's mark or the lamp's label, at 25 to 30 cm. | 8 | maker, model, safety label (card 4) | label photo, all sites |

Asked only when: chips and cracks close (card 12), the lamp lit (function unsettled).

### media: books and media

Process: `instant` front cover and back with barcode. Without LiDAR: the same.

No scan. The barcode does most of the work: an ISBN match fills the listing from the catalogue (*observed*, listing-fields §6).

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Front cover | Flat, square-on, 30 to 40 cm. | 5 | title and edition candidates (card 9) | cover, all sites |
| 2 | Back with barcode | Turned over. | 6 | ISBN or UPC (card 4) | photo 2, all sites |

Asked only when: the copyright page (edition unsettled among the candidates, *observed* source, identity-schema §9), the spine (wear unsettled), the disc or record surface (media condition), the inner sleeve or booklet (completeness).

### cards_collectibles: trading cards

Process: `instant` front and back. Without LiDAR: the same.

No scan, no measurements (identity-schema §10).

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Front | Out of the sleeve if the sleeve glares, flat on a dark matte surface, square-on at 20 to 25 cm. | 5 | card identity (card 9), centring, surface | cover, all sites |
| 2 | Back | Turned over. | 5 | set and number (card 4), back surface | photo 2, all sites |

Asked only when: the four corners and edges, when the price gap between condition grades for this card is wide enough that the close-up earns its seconds under card 3 below.

### toys_lego: toys and sets

Process: `instant` box or set front for a boxed set; `scan` for a built set or a rigid toy over 10 cm, chosen by the first frame's extent. Without LiDAR: the 8-still ring, dimensions by lookup of the set number.

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Box or set front | Square-on at 40 to 60 cm, or a scan for a built set or a rigid toy over 10 cm. | 6 to 25 | set number (LEGO: on the box or booklet, *observed*, identity-schema §11), identity (card 9) | cover, all sites |

Asked only when: the contents laid out (completeness unsettled, [card 15](seeing-the-item.md#15-completeness)), the figures, a function video, the battery bay.

### appliances_tools: tools

Process: `scan`, then `series` rating plate. Without LiDAR: the 8-still ring, dimensions by lookup of the model on the plate.

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Scan | One ring at 0.9 to 1.5 m. | 25 | kind, identity, dimensions, flaws | cover, sides, all sites |
| 2 | Rating plate | At 25 to 30 cm (*observed* location, identity-schema §8). | 8 | model, voltage, serial (card 4) | label photo, all sites |

Asked only when: the battery and charger (completeness), a short running video (function unsettled), the blade or bit wear (card 12).

**Kinds outside the brief's list.** Bikes and sports gear and baby gear take the rigid default, a scan then the identifier still: the serial under the bottom bracket for bikes (*observed*, identity-schema §12), the model and date label for baby gear, which also feeds the recall lookup ([capture facts](../features/capture.md#facts-to-know)). Process for `bikes_sports`: `scan`, then `series` serial. Process for `baby_gear`: `scan`, then `series` model and date label. Without LiDAR, both: the 8-still ring, dimensions by lookup.

### other

Process: `instant` one front still; then `scan` only if the first frame shows a rigid item over 10 cm, else a `series` back still. Without LiDAR: the 8-still ring, dimensions by lookup, then a card beside it. The first still also goes to `capture_judge`, which may move the item to a named type; a move keeps every photo and adds that type's missing frames as `missing_shot` ([capture](../features/capture.md#what-the-person-does-and-sees)).

| # | Shot | How | s | Settles | Becomes |
|---|---|---|---|---|---|
| 1 | Front | Square-on at 30 to 60 cm, or the scan for a rigid item over 10 cm. | 5 to 25 | kind ([card 1](seeing-the-item.md#1-item-kind)), identity (card 9), colour, flaws | cover, all sites |
| 2 | Any label | Whatever mark the item carries, at 25 to 30 cm, asked only when card 4 sees text it cannot read. | 8 | brand, model (card 4) | label photo, all sites |

### On a phone without LiDAR

The person makes the same move-around, so there is one gesture to learn. Without scene depth, ARKit still tracks the phone's pose and finds the floor plane (*inferred*, [adaptive-capture §4](../../research/capture/nate/adaptive-capture.md)). So the auto-shutter takes a 12 MP still each time the phone enters a new 45° bin, 8 stills for one ring (start). Card 21 picks from them as from scan frames. Dimensions come, in order, from: a lookup of the identified model's dimensions; then a coin or card laid beside the item; then, only when a target site needs the field, a typed value. Object Capture is unavailable without LiDAR ([capture facts](../features/capture.md#facts-to-know)), so there is no spin model.

### Is 3D effective for clothes?

Nate asked: "Would 3d for clothes really be effective, whats the easiest for a user to take?" ([words](../../product/words.md#2026-11-14-nate-is-3d-for-clothes-effective)). The evidence says no, for capture or for listings:
- Apple lists soft and bendable objects as poor input for Object Capture, and fabric photogrammetry gives a "lumpy mess" (*observed* and *asserted*, [scan-to-images](../../research/capture/nate/scan-to-images.md)).
- The iPhone model is `.reduced`, one 2048 px texture, so a render loses the tag, the weave and small print (*observed*, scan-to-images).
- No used-goods marketplace was found that takes a phone scan, and eBay has no 3D media type (*observed*, scan-to-images (i)).

The easiest capture for a garment is the flat lay: front, back, tag. The answer given earlier holds for soft items and rigid items over 10 cm. It needed four corrections, now in the plans above:
- Small items under 10 cm (cards, watches, jewellery) get close-ups, not a scan.
- Reflective items get stills, with dimensions by lookup or a reference object.
- Furniture over 2 m needs Area Mode or a step back.
- A label or serial always needs its own 12 MP still, even after a scan.

## 1. Which plan an item gets

**Determines**: the default ordered shot list for this item, and whether it starts with a scan or with stills.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| the type the person picked, one tap on the type suggested from the first frame ([card 1](seeing-the-item.md#1-item-kind) on the phone) | which table above | selects the process | the processes are per type; the person's pick is `you_said`, so it outranks the suggestion |
| `capture_judge` on the first kept still | moves the item to another type | override, raised as `category_unsure` when unsure | a wrong pick costs a retake; a swap keeps every photo |
| LiDAR present on the phone | scan or the 8-still ring | switch | Object Capture needs LiDAR (*observed*) |
| outline softness, extent under 10 cm, reflectivity from the first frames | swaps a scan for stills | override | soft, small and reflective items fail the scan ([adaptive-capture §9](../../research/capture/nate/adaptive-capture.md)) |

**Method**
1. Rule. Take the picked type's process.
2. If the phone has no LiDAR, replace the scan with the 8-still ring.
3. If the item is soft, under 10 cm, or reflective over most of its mask (depth confidence low on over 40% of the mask, start), replace the scan with stills and take dimensions by lookup or reference.

**Why this method**: the per-class limits are documented, so a rule settles the choice with no model. The alternative is to let a model choose per item; it would add a call before the first shot for a choice the class already makes.

**When it is not shown**: the plan is never shown as a list up front. The person sees one instruction at a time ([capture](../features/capture.md#what-the-person-does-and-sees)).

**How it is explained**: "Walk around it" with the coverage ring, or the garment outline. Tap shows what is done and what is left, as in card 3 of seeing-the-item.

**Speed**: on the phone, within the first frames.

**Check later**: on the 30-item test, the plan's items against the field-change rate. It is wrong if a kind's swapped plan settles fewer fields in the same seconds.

## 2. What a shot is worth

**Determines**: for a candidate shot, how much it would settle, on a 0 to 1 scale per field.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| fields the shot's view settles (`requirement.views_needed[]`) | which fields count | defines the sum | a shot only counts for what it can show |
| current confidence of each field | how unsettled it is: 1 minus confidence | multiplier | do not pay for what is known |
| a target site requires the field ([listing-fields §6](../../research/list/nate/listing-fields-by-platform.md)) | field value 1.0 | start | a missing required field blocks the listing |
| a site names the field as a search driver (listing-fields §7) | field value 0.6 | start | Nate's value: listings written for each site's search |
| `requirement_fold` weight from `param_fold` ([product §6](../product.md#real-time-weights-agent-proposal)) | field value once learned | replaces the start values | measured effect on the sale beats a guess |
| any other field | 0.2 | start | a description detail |

**Method**
1. Arithmetic. `worth(shot) = sum over its fields of value(field) x (1 - confidence(field))`.
2. For identity fields, use card 17's normalised EIG in place of `value x (1 - confidence)` ([card 17](seeing-the-item.md#17-which-question-to-ask-next-and-when-to-stop)), so one quantity means one thing.

Worked start values: the tag on a tee with no visible logo settles brand (1.0 x 0.7) and size (1.0 x 1.0) plus origin (0.2 x 1.0), worth 1.9. A care label after a tag that gave no fibre settles material (0.6 x 0.9), worth 0.54.

**Why this method**: expected value of information, summed per field and weighted by what the field does for the listing, is the standard shape and needs no model (inferred). Photo count raised sale odds more than photo quality did (*observed*, [quality-and-value-classifiers §3](../../research/price/nate/quality-and-value-classifiers.md)), so worth counts fields settled, not prettiness. The alternative, a fixed list per kind, asks for what a read label already settled.

**When it is not shown**: never shown as a number.

**How it is explained**: see card 3.

**Speed**: local arithmetic after each accepted view.

**Check later**: on the 30 items, each asked shot's worth against whether it changed a field. It is wrong if shots under the bar changed fields as often as shots over it.

## 3. Whether an extra shot is asked

**Determines**: whether a shot outside the default is asked for, in what order, and when asking stops. It applies [card 3 of seeing-the-item](seeing-the-item.md#3-what-must-still-be-captured-and-when-it-is-enough) to shots, with card 17's bar.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| worth ([card 2](#2-what-a-shot-is-worth)) | the gain | numerator | |
| effort, card 17's scale | a still at hand 2; a still that needs a handling step (turn inside out, open, flip, unscrew) 3; a typed value 3 | denominator | one effort scale for questions and shots |
| card 17's bar | 0.15 per unit of effort | start | the same bar a question must pass |

**Method**
1. Arithmetic. Ask a shot when `worth / effort ≥ 0.15`. A still at hand must be worth at least 0.30; a still with a handling step, at least 0.45.
2. Order the asked shots by `worth / effort`, then by the pose bin nearest the phone now, as card 3 of seeing-the-item does.
3. Default shots are asked without the test; they are the plan.
4. Stop when no shot passes the bar, or the person taps Done. There is no shot cap.

So for the tee above: the tag (1.9 / 2) is in the default anyway; the care label (0.54 / 3 = 0.18) is asked; a fabric close-up after the care label read the fibre (0.6 x 0.1 = 0.06 / 2) is not.

**Why this method**: one bar for shots and questions means one rule for "worth the person's effort", and the default plan stays as short as Nate asked. The alternative is a cap on extra shots; the cap had no source ([capture design choices](../features/capture.md#design-choices)), and it drops a second flaw.

**When it is not shown**: when nothing passes, no prompt appears and the unsettled fields show their unknown reason.

**How it is explained**: one line naming the field, for example "One more: the care label." Tap shows "So the listing can say what it's made of."

**Speed**: local.

**Check later**: the same 30-item test as card 2, plus seconds per item. It is wrong if raising the bar to 0.25 loses no field that moved a price or a sale.

## 4. What each shot costs in seconds

**Determines**: the seconds per shot used in the tables and in the speed bar.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| the start values in the tables above | seconds per shot | start | no source times single shots |
| Ben's bar, a tee in under 70 s | the total | bar | Ben §11 |
| shot logs from the app | measured seconds from instruction shown to shot kept | replaces the start values | measured beats a guess |

**Method**: arithmetic. Median of measured seconds per shot kind and item kind, once 30 items exist.

**Why this method**: seconds are measured directly in the app's log, so no model is needed. The alternative, card 17's effort units alone, cannot test the 70 s bar.

**When it is not shown**: never shown.

**How it is explained**: not explained to the person.

**Speed**: logged on the phone.

**Check later**: it is wrong if the measured clothing default exceeds 45 s of shots plus laying out.

## 5. When a retake is asked

**Determines**: whether a failed shot is asked again, and with which one instruction.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| [card 2 of seeing-the-item](seeing-the-item.md#2-whether-a-frame-is-a-usable-view) | whether the frame is usable | gate | one name for one thing |
| the levers in [capture-coaching §5.2](../../research/capture/ben/capture-coaching-and-frames.md) | which fix to name: closer, steadier, glare, light | first failed lever in Ben's rank | one instruction, the one most likely to fix it |
| worth ([card 2](#2-what-a-shot-is-worth)) | whether the field still needs the shot | same bar as card 3 | a retake is a shot |

**Method**
1. Rule. A shot that fails card 2 of seeing-the-item is retaken only if its worth still passes card 3 here.
2. The instruction names the first failed lever, for example "Closer on the tag."
3. After 2 failed attempts the row is unobtainable (card 3 of seeing-the-item).

**Why this method**: retakes reuse the frame gate and the shot bar, so nothing new is decided. The alternative, always retaking a failed default shot, spends seconds on a field another shot may already have settled.

**When it is not shown**: the field is settled elsewhere, or 2 attempts failed.

**How it is explained**: the lever's line and an arrow, one at a time ([copy](../../product/copy.md)).

**Speed**: on the phone.

**Check later**: retakes per item and the share that succeed. It is wrong if under half of second attempts pass.

## 6. When a scan or a video replaces photos

**Determines**: whether an item gets a scan, a still ring, stills, or a short video.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| the per-class table, [adaptive-capture §9](../../research/capture/nate/adaptive-capture.md), and [scan-to-images](../../research/capture/nate/scan-to-images.md) by class | where a scan holds | rule | documented limits |
| scan frames carry pose, depth and mask (*observed*, scan-to-images (a)) | why a scan beats stills on rigid items | reason | one move gives photos, dimensions and masks |
| guided capture covers more (95% within 5 cm versus 60% unguided, *observed*, adaptive-capture §6) | why the ring is guided | reason | |
| video as listing media: eBay one video, about a minute; Etsy 3 to 15 s (*observed*, scan-to-images (i)) | where video goes | rule | a site takes at most one video |

**Method**
1. Rule. A scan replaces the separate views on rigid items over 10 cm that are not mostly reflective (card 1).
2. A scan never replaces a label, serial, plate, tag or barcode still. Text needs a 12 MP still (capture-coaching §5.3).
3. A video replaces nothing. It is asked only when function is a field worth asking under card 3 (a toy, a tool, electronics powering on), at 10 to 15 s, and goes to the sites that take one.
4. Talk mode's video is for the conversation; its 768 px frames do not stand in for a label still (§5.3).

**Why this method**: the scan gives views, dimensions and masks from the gesture Nate named, where it holds; stills are kept where the sources show a scan fails. The alternative, a scan for everything, fails on fabric, small and reflective items.

**When it is not shown**: not applicable; the plan just starts with the ring or the outline.

**How it is explained**: "Walk around it."

**Speed**: on the phone; frames are kept as they are taken.

**Check later**: the 30-item test on both phones. It is wrong if the still ring settles the same fields as the scan in fewer seconds on rigid items.

## 7. When depth gives a measurement without a tape

**Determines**: whether a measurement can come from depth or the floor plane alone, so no tape shot is asked.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| [card 10 of seeing-the-item](seeing-the-item.md#10-each-measurement) and [card 11](seeing-the-item.md#11-uncertainty-of-each-measurement) | the measurement and its uncertainty | owns the method | one name for one thing |
| LiDAR accuracy: ±1 cm for sides over 10 cm, best from 20 cm to 2 m (*observed*, [adaptive-capture §1](../../research/capture/nate/adaptive-capture.md)) | where depth holds | bound | |
| the flat-enough check ([capture-coaching §7.2b](../../research/capture/ben/capture-coaching-and-frames.md)) | whether a garment lies flat enough | gate | Ben's check |

**Method**
1. Rule. No tape is asked when card 11 puts every primary field inside its budget ([capture bars](../features/capture.md#how-we-will-know-it-works)).
2. That holds for rigid items over 10 cm, within 20 cm to 2 m, not mostly reflective, with LiDAR.
3. For garments, card 10 measures from the front and back flat lay once the flat-enough check passes; the tape is an extra shot under card 3 when it does not.
4. Without LiDAR, the order is the identified product's published size chart with the floor plane as the cross-check; a coin, card or printed marker laid beside the item is asked only when the two disagree or no size chart exists, because it is extra input.

**Why this method**: the default plans already contain the views card 10 measures from, so a tape shot is only worth its seconds when card 11 says the number is out of budget. The alternative, a tape on every garment (Ben, §7.3), adds a shot and a handling step to every item.

**When it is not shown**: a field out of budget with no tape shot shows its range, not a number.

**How it is explained**: as card 10 and card 11 of seeing-the-item.

**Speed**: as card 10.

**Check later**: tape-checked fields on the 30 items. It is wrong if under 80% of primary fields fall in budget without the tape.

## 8. The one frame and each site's crop

**Determines**: the shape of every listing photo, and how each site's crop is cut from it.

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| Ben's decided frame, 3:4 at 1200x1600, from studio's templates ([capture-coaching §6.2](../../research/capture/ben/capture-coaching-and-frames.md)) | the frame | decided | Ben |
| the sites' shapes: 1:1 on eBay, Depop, Mercari, Facebook and OfferUp; 3:4 on Poshmark; 4:5 on Grailed (from the brief, as recorded in [studio](../features/studio.md)) | the crops | rule | |

**Method**
1. Rule. The item sits inside the centred 1200x1200 square of the 1200x1600 frame. The overlay draws that square.
2. The 1:1 crop is the square. The 3:4 crop is the full frame. The 4:5 crop is 1200x1500, centred on the square.
3. Labels and close-ups keep the full-resolution still for reading; only the exported photo is cut to the frame.

**Why this method**: one frame with the item in its centre square makes every site's crop lossless, so the person shoots once. The alternative, a shot per site shape, multiplies the shots.

**When it is not shown**: never.

**How it is explained**: the overlay itself.

**Speed**: crops are arithmetic at export.

**Check later**: on the 30 items, the share whose item touches the square's edge. It is wrong if over 1 in 10 lose part of the item in a 1:1 crop.

## 9. Which retouch route runs for a photo

**Determines**: for a photo the person chose Generate on ([studio](../features/studio.md#retouch-chosen-by-the-person)), which route runs (level 0 true color with no model, level 1 light, level 2 pressed, re-lay) and how many candidates are drawn. Owning feature: studio. Nate: "Studio cost will be calculated optimally." ([words](../../product/words.md#2026-11-14-nate-the-search-engine-is-an-api-no-feeds-no-tax-service-tags-on-retouched-photos)).

**Sources and weights**

| source | what it contributes | weight or rank | why that weight |
|---|---|---|---|
| the level the person picked | the highest level allowed | ceiling | the person chose; never exceed it |
| photo role | tag, label, serial and flaw photos: no route | gate | studio's rule |
| expected gain: the photo score lift of the route over level 0, from studio's check numbers on past items of this kind, times the photo's weight in card 21's order (cover 1.0, others 0.3, start) | the gain | numerator | the cover drives the click; photo count beat quality for sale odds (*observed*, [quality-and-value-classifiers §3](../../research/price/nate/quality-and-value-classifiers.md)) |
| per-call price of each model, read from the provider at run time | the cost | denominator | prices change; never a fixed number in the spec |
| past pass rate of the check for this route and kind | candidates needed | sets n | draw enough to expect one pass |

**Method**
1. Rule, then arithmetic. Level 0 always runs; it has no model cost.
2. For each allowed paid route, `value = expected gain x item price estimate - expected cost`, where expected cost is the per-call price times n, and n is the smallest count giving at least a 0.8 chance (start) of one candidate passing the check, given the past pass rate.
3. Run the route with the highest positive value; if none is positive, offer level 0 and say the light is already good.
4. Until 30 items of a kind have check numbers, use the gain start of 0.05 photo-score points per level for the cover and 0.02 for others (start).

**Why this method**: gain against cost per photo spends model calls where they move the cover of a worthwhile item, with no cap. The alternative, a fixed per-item budget, either starves an expensive item's cover or pays for light on a photo that does not need it.

**When it is not shown**: never shown as a number; a skipped paid route shows as level 0 offered.

**How it is explained**: on the approval card, "Light was already even" when no paid route ran.

**Speed**: arithmetic before the job starts.

**Check later**: per kind, chosen route value against measured score lift and spend. It is wrong if photos where no paid route ran later score as low as those it would have improved.

## Summary

| name | owning feature | main sources | method in five words | hide rule |
|---|---|---|---|---|
| 1 Which plan | capture | the person's type pick, card 1's suggestion, LiDAR, adaptive-capture §9 | picked type's process, swapped by limits | never shown as a list |
| 2 Shot worth | capture | listing-fields §6 and §7, score | value times unsettled, summed | never shown |
| 3 Extra shot asked | capture | card 2, card 17 bar | worth over effort, 0.15 | nothing passes the bar |
| 4 Seconds per shot | capture | start values, shot logs | median of measured seconds | never shown |
| 5 Retake | capture | card 2 of seeing-the-item, §5.2 | failed gate, still worth it | settled elsewhere or 2 failures |
| 6 Scan or video | capture | adaptive-capture, scan-to-images | rigid over 10 cm: scan | not applicable |
| 7 Depth without tape | capture with measure | cards 10 and 11, §7.2b | in budget, no tape | out of budget shows a range |
| 8 One frame, crops | capture with studio and list | Ben's frame, site shapes | centred square, lossless crops | never |
| 9 Retouch route | studio | check numbers, model prices, card 21 | best positive gain minus cost | level 0 when none pays |

## What cannot be determined credibly

- Seconds per shot: no source times single shots; every value above is a start until the shot logs exist.
- Whether the guided default beats an adaptive session on time and errors: no head-to-head was found ([adaptive-capture §6](../../research/capture/nate/adaptive-capture.md), not found).
- Field values for search weight per site: the sites say which fields help, not by how much (listing-fields §7); 1.0 and 0.6 are priors that `requirement_fold` updates.
- Depth accuracy on black or glossy shoes and leather: the sources call it weak without a number.

## What this area needs from other areas

- **List**: the per-site photo order and caps that take card 21's order, and the listing-creation step where studio's choice sits.
- **Data**: `requirement_fold` weights per field, which replace card 2's start values.
- **Measure**: card 11's budgets per field for the no-tape rule.
- **Identify**: model dimensions by lookup for phones, reflective items and phones without LiDAR.
- **Shared model** ([product.md](../product.md)): `requirement.seconds` and the effort unit per row; `capture.type` (the picked family), `capture.suggested_type` and `capture.process[]` (each step `instant`, `series` or `scan` with its frames), as listed in [capture](../features/capture.md#needs-from-the-shared-model). The photo roles this page uses are already in product.md.

## What its parameters learn from (*agent proposal*)

Every learned number on this page is a `param` row whose written value is the prior. It updates from three sources, each written as an `observation` with evidence and a weight for how sure the outcome is: every listing the protocol reads on a site and what changed when it was read again (a price or rank change, a sold mark, a disappearance counted as a probable sale by age and the site's sell-through); what platforms and industries publish, gathered by the information engines; and our own users' outcomes, the most exact rows, which calibrate the rest. Learning does not wait for our users. How rows update, promote, guard and roll back is in [product §6](../product.md#real-time-weights-agent-proposal).
