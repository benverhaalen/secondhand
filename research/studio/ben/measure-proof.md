# Proving a redrawn photo keeps the item's real size
Researched 2026-11-15 by Ben (Claude). Feature: studio.

Written 2026-11-15 by Ben (Claude Code, thread "Perfect every listing photo automatically"). Feature: studio. An *agent proposal* until Ben or Nate decides. Lines marked *observed* come from runs in [slides/runs/](slides/runs/) and the proof sheets in [slides/proof/](slides/proof/).

Ben, 2026-11-15 07:51 UTC: "people could say it lies. how do we prove in some respect it doesnt. by using its actual measurements (of course with a boundary of error) to audit and compare the ai generated outputs against the actual image of the shirt ... can show images are accurate to measurements by knowing what the pit to pit and length on a shirt is and plan on showing this visually somewhere on the website or pitch etc."

Ben, 08:14 UTC: "the alternate photos show it with actual measurements and use those to measure size too. like how are you going to detect like in the scrunched photo how you would know the actual pit to pit or top to bottom say it would be flattened. think about solving that problem"

## What can be proven, from first principles

1. **A photo has no scale.** Nothing in a picture of a shirt on the floor says how many pixels make an inch. So a single photo can only state proportions, and a tape number turns a proportion into inches. With two taped numbers (pit to pit and length), one sets the scale and the other is a test. A long sleeve with its sleeve taped gives two tests.
2. **A scrunched photo cannot give the flattened size.** An outline is what faces the camera. A fold or bunch hides fabric, so the width the camera sees is at most the real width, never more (camera tilt aside). The hidden fabric is not in the pixels, and no model can measure it; it can only guess. So the scrunched photo is never where the size comes from. The tape is.
3. **What a scrunched photo can give:** the item's identity (prints, letters, color, wear), and, once it has a scale, a floor: the item is at least this wide.
4. **Where the size comes from: LiDAR.** Ben, 09:00: "how about just allow this feature for lidar phones. assume all phones have lidar. dont overengineer" ([words](../../../product/words.md#2026-11-15-prove-the-redraw-keeps-the-real-size-on-lidar-phones)). The capture's LiDAR frame gives the photo a real scale, so it measures pit to pit and length itself. It cannot see fabric folded under, so the measuring frame is the flat lay that capture already coaches, not a scrunched one. So the rule in [plan.py](../../../jobs/studio/plan.py) (`relay_measured`): **no LiDAR measurement, no re-lay** (Ben, 09:09: "only allow this from lidar flow too"). A tape photo or a typed number does not open it. An unmeasured cover is only touched up where it lies. Testing the enhancement waits until the LiDAR capture works (Ben, 09:09). Pants are touched up only, until the ruler reads them. The runs above used the tape photos, which no longer open the re-lay; a capture fixture's `tape.json` with `"from": "lidar"` will. (A print-as-ruler and a tape-tick reader were built and dropped for this rule; they are in git history at bc79136.)
5. **The AI is not the thing that keeps the size; the check is.** Observed on the Marquette tee: all 15 redraws, as the model drew them, read 8% to 21% narrow against the taped 21.25 in. Every published slide reads within 1.2%, because [check.py](../../../jobs/studio/check.py) sets the width to the tape, and drops any redraw it cannot bring within 8%.

So the truthful claim is **"every AI photo is measured against your tape before it posts, and if it can't be made to match, your real photo posts instead."** The claim "the AI keeps your measurements" is false and should never be made.

## How the proof works ([measure.py](../../../jobs/studio/measure.py), [proof.py](../../../jobs/studio/proof.py))

The ruler reads a flat top the way a person lays a tape (definitions from [slides.json](../../../jobs/studio/slides.json) `measurements`):

- **length:** from the highest point of the shoulder beside the collar (or beside the hood) straight down to the hem;
- **pit to pit:** straight across the body one inch below the armpits. The armpit is the top of the gap between a sleeve and the body.

When a sleeve lies along the body there is no armpit to see, and the ruler says so instead of guessing (observed: the tee's phone photo with one sleeve folded, the hoodie redraws whose sleeves hang close, and the arms-folded synthetic test). Floor seen between a sleeve and the body is given back to the floor first, by color.

For each top it measures three pictures: the phone photo as laid, the winning redraw exactly as the model returned it, and the published slide. It draws the two tape lines on each (white with an ink edge and end ticks, no text, so the site and the deck set their own type) and writes every number to `proof.json`.

The checks on the ruler itself:

- synthetic tees of known size read back within 2% ([test_measure.py](../../../jobs/studio/test_measure.py));
- the published Marquette slide stretched on purpose by 0.88 to 1.12 reads back the stretch within 1.2 points, and every stretch of more than 5% lands outside the band (observed, `bench` in the tee's `proof.json`);
- the check that repairs the width measures a different line (the lower body against the outline's height) from the ruler (one inch under the armpit against shoulder to hem). They agree to 0.5% on the published tee (observed). That is weak independence, since both use the same tape, and is stated as such.

## Error bound

*Agent proposal:* **within 5% of the measurement, about one inch on a 21 in chest**, half a size step. The reasons are in the next section.

## Why each number

Ben, 09:09: "make whatever numbers you come up with have a reason. a specific reason why you chose those bounds." Each number the proof and the ruler use, with its reason and how firm that reason is. *Measured* means observed in these runs; *chosen* means picked from a stated rule, not tuned.

| Number | Where | Reason | Firmness |
|---|---|---|---|
| 5% band for a published top (about 1 in on a 21 in chest) | `proof.BAND` | Half a size step. Gildan 5000 chests step 1.75 to 2.75 in from one size to the next (S 17.5, M 19.25, L 21.5, XL 23, 2XL 25.75 in, [Fangamer's Gildan 5000 chart](https://www.fangamer.com/pages/size-chart/gildan-5000), observed 2026-11-15, its "A" row; the chart calls them averaged approximations). An error under half a step cannot make a shirt read as the next size. The error sources add to about 3.7%, so 5% fits them: the tape (1.2%), the ruler (2%), the edge (0.5%). | chosen from a stated rule; the size steps are one brand's |
| 0.25 in for a tape read on cloth | `proof.TAPE_READ` | A cloth tape's finest mark is 1/8 in, and a soft garment edge sits somewhere across about two marks. On the Marquette chest photo the edge falls between 21 and 21.25. | measured on one photo |
| 8% drop band in the check | `check.BAND` | Set by another thread from honest pants redraws reading 1 to 6% off the tape. On tops it rarely matters: the check sets the width to the measurement first, and published tops read 0.0 to 1.2% off. | measured; pants are now touch-up only, so this band should come down to 5% for tops |
| 20%: past this the check won't stretch a redraw back | `check.check` | Stretching cloth by a fifth visibly stretches its weave and any print the model kept. The model's worst honest draw was 21% narrow, and that one was dropped. | chosen, one observation at the edge |
| 2% ruler error | `test_measure.py` | Synthetic tees of known size read back within 2%, and the stretch bench tracks the stretch within 1.2 points. | measured |
| 0.20 to 0.46 of the length for the armpit | `measure.measure` | Laid-out tees put the armpit at 0.44 of the length. The two wrong cases sat at 0.49 (a folded sleeve) and 0.50 (sleeves hanging close). The bound sits between them. | measured on four pictures; thin |
| 0.85 to 1.25 of the body for the pit row's width | `measure.measure` | One inch under the armpit the body is about as wide as lower down. Wider than a quarter more means a sleeve is in the row. | chosen |
| 1 inch under the armpit | `measure.measure` | The definition in `slides.json` `measurements` and on resale sites' how-to-measure pages. | definition |
| Floor color: 22 apart, under half the distance to the cloth, lightness at half weight; cloth within 25 of the floor is left alone | `measure.floor_holes` | Floor in a sleeve's shadow measured 25 from the open floor at full weight and 14 at half weight, against 46 from the red cloth. A garment the floor's own color cannot be split by color at all. | measured on one hoodie |
| Press 35% | `check.PRESS` | 60% left blotches on the tee that could read as stains (run 5). 35% left none on the same two redraws ([press-strength.jpg](slides/proof/press-strength.jpg)). | measured on two items; Ben's taste call |
| Stretch bench 0.88 to 1.12 | `proof.STRETCH` | Points inside and outside the 5% band on both sides, out to past the worst repaired error. | chosen |
| Two second pressings per item | `slides_run.STEAM_TOP` | Four Nano Banana calls, about $0.15 an item. They took the tee's fold shading from 0.86 to 0.85 and the pants from 0.93 to 0.90. | measured, small gain; a cut candidate if cost matters |

## Results

All *observed*, on the one item with tape, the Marquette tee (27 in long, 21.25 in pit to pit), over three full runs. Proof sheets: [run 3](slides/proof/20261115-0652/marquette-tee/preview.jpg), [run 4](slides/proof/20261115-0800/marquette-tee/preview.jpg), [run 5](slides/proof/20261115-0836/marquette-tee/preview.jpg). Plain pictures with only the tape lines on them, for the site and the deck to set type on: `photo.jpg`, `drawn.jpg`, `final.jpg` in each folder.

| Picture | Count | Pit to pit read (length set to 27 in) | Off the tape | Within 5% |
|---|---|---|---|---|
| Phone photo, as laid | 1 | no reading: the folded sleeve hides one armpit | n/a | n/a |
| AI redraw, as the model drew it (every first-pass candidate) | 15 | 16.8 to 19.5 in | -8% to -21% (-1.7 to -4.5 in), all narrow | 0 of 15 |
| Published slide | 3 | 21.25, 21.5, 21.1 in | 0.0%, +1.2%, -0.7% (at most 0.25 in) | 3 of 3 |

Every number is in [drawn-tee.json](slides/proof/drawn-tee.json) and each run's `proof.json`.

Read honestly: **the model alone never once kept the width** (15 of 15 drawn narrow). Every published slide did, because the check set it to the tape. Three slides of one tee show the method works. They are not a rate for the product.

The ruler's own test, the published slide stretched on purpose (run 4): stretches of 0.88, 0.92, 1.05, 1.08 and 1.12 all land outside the 5% band; 0.95, 0.97 and 1.03 land inside; the reading moves with the stretch within 1.2 points.

The hoodie: run 5's redraw hangs the sleeves close to the body again, so no pit line (the ruler refuses an armpit lower than 0.46 of the length). Run 4's hoodie was laid with a gap, but has no tape to test against.

### Wrinkles

`left` is the share of the phone photo's fold shading still in the slide ([lay.wrinkle](prototype/lay.py): lightness ripples at fold size, prints and edges left out). Lower is flatter. *Observed*, on the published cover:

| | Tee | Hoodie | Pants |
|---|---|---|---|
| Run 3 (before this work) | 0.87 | 0.84 | 0.96 |
| Run 4 (harder prompt, a second model pressing, smoothest passing wins) | 0.85 | 0.75 | 0.90 |
| Run 5 (run 4 plus the deterministic press at 60%, tops only) | 0.56 | 0.39 | not run |

The model keeps most fold shading however hard it is asked, so the prompt alone moved the number by 2 to 9 points. The press moved it by 30 more. At 60% the press left soft blotches on the tee's body that a buyer could read as stains, so the default is now 35% ([press-strength.jpg](slides/proof/press-strength.jpg) shows none, 35% and 60% on the same redraws). Pants are left out of the press on purpose: on faded denim and canvas the fading sits in the same band as the folds.

## What it needs next

- **LiDAR measurements from capture, onto the item.** The capture build plan already saves depth, intrinsics and the floor plane per photo ([build-plan.md](../../capture/ben/build-plan.md)). The studio job needs the measured `pit_to_pit` and `length` (tops) on the item, the way `tape.json` carries them here.
- **More measured items.** One tee is a demonstration, not a rate. A claim like "N of N published photos within an inch" needs at least ten measured tops. The hoodie needs pit to pit, length and sleeve.
- **Hoodie and sweatshirt lay.** Redraws often hang the sleeves along the body, which hides the armpit and leaves nothing to measure. The `whole_look` lines now ask for a clear strip of floor between each sleeve and the body; run 4 did it, run 5 did not.
