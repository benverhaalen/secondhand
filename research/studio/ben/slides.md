# What every listing photo should look like, slide by slide, and how a few casual photos become that set

Written 2026-11-15 by Ben (Claude Code, thread "Perfect every listing photo automatically"). Feature: studio. Everything here is an *agent proposal* until Ben or Nate decides; lines marked *observed* come from runs in [slides/runs/](slides/runs/).

Ben's ask, 2026-11-15 06:01 UTC: "clearly defining roughly what the image should look like when unwrinkled and what should be slide 1, slide 2, etc. and ensuring edge cases. defect photo is hard to do. where different graphics could be. how to effectively organize a slide of photos and generate them from not taking individual photos with the tool and then giving templates effectively to magically get each image beautified and perfected. ensure this capability on the backend actually works super well."

The rule it follows is Ben's: touch up, never change the environment or lie ([words](../../../product/words.md#2026-11-14-photos-touch-up-never-change-the-environment)), with flattening and the re-lay allowed ([words](../../../product/words.md#2026-11-14-re-lay-iron-and-audit-the-measurements)).

## The answer in one paragraph

The person takes whatever photos they took. One vision read sorts them (front, back, tag, print close-up, flaw, tape) and boxes every print and flaw. A planner builds the slide set for that garment kind from [jobs/studio/slides.json](../../../jobs/studio/slides.json). Only slides 1 and 2, the whole item front and back, are redrawn: laid into the kind's template and ironed, by four candidates in parallel. Every candidate is checked against the real photos, and a candidate that loses a print, changes a letter, invents a label, drops a flaw or changes the garment's shape is thrown out; if all four go, the real photo is slide 1. Everything after slide 2 is a real photo, cut and exposed, never redrawn. A slide the photos cannot honestly make is asked for, never drawn.

## Slide order

The same skeleton for every garment, from the spec file. The cap per site drops from the end first and never drops the cover, the tag or a flaw (`for_site` in [plan.py](../../../jobs/studio/plan.py)).

| Slide | Shows | Made from | Can a model draw it? |
|---|---|---|---|
| 1. Cover | whole item, front up, laid into the template, ironed | the real front photo | yes, the re-lay; real photo if every candidate fails |
| 2. Back | whole item, back up, same lay | the real back photo only | yes, same; **never drawn from the front** |
| 3+. Prints | each print, logo or patch, close enough to read | its own close-up, else cut from slide 1 or 2's photo | no |
| Tag | brand and size, every letter readable | the tag photo only, never cut from a far shot | no |
| Fabric | the real wear: fading, pilling | its own close-up, else a plain patch cut from the front | no |
| Details | parts buyers check for this kind (table below) | detail photos | no |
| Flaws | one slide per flaw | its close-up, else cut from the whole photo | no, not even exposure |
| Measurements | tape across one measurement | tape photos | no |
| Care label | fibre and care | care photo | no |

Pants and shorts put the waistband and fly detail before the prints, since that is where their brand patch and fit live. Jackets put hardware before fabric.

## What "unwrinkled" looks like, per kind

The `whole_look` line for each kind is both the target and the exact words sent to the model. Templates are the dashed outlines in [templates/](templates/), sized to Ben's own covers.

| Kind | Template | The lay | Kept exactly, always |
|---|---|---|---|
| Tee (short sleeve, polo, tank) | shirt | collar centred at the top, shoulders level, both sleeves out about 30° below level with hems open, side seams straight, hem straight, no fold lines across chest or stomach, print flat | neck tag tucked in (stops the model drawing a fake one), print size and place, fading |
| Long sleeve (and button-up, jersey) | sweatshirt | as the tee, sleeves out and down about 45° with the full length and open cuffs visible, nothing folded under, buttons done | sleeve length (it is measured), cuff wear |
| Crewneck sweatshirt | sweatshirt | neck rib round and centred, sleeves down about 45°, cuff ribs straight not flipped, waistband rib straight not rolled, body boxy | rib stretch, pilling |
| Hoodie | sweatshirt | hood flat above the shoulders, opening up and centred, sleeves down about 45°, pocket flat, drawstrings straight and even, zip closed, waistband straight | the hood's print, cuff fraying |
| Jacket (coat, fleece, vest) | sweatshirt | closed the way it was shot, collar folded down evenly, sleeves down, pockets flat, hood behind the collar | quilting, corduroy and fleece texture |
| Pants (jeans, chinos, work pants) | pants | sideways, waist on the left (Ben's lay), front up, legs together and parallel, fly closed, button done, hems square, no twist on the inseam | denim fading and whiskers, knee wear |
| Shorts | pants | waist at the top, legs straight down, fly closed, hems square | same |
| Shoes, bags, hats, accessories | none | **not re-laid**: only the light is evened, in place | toe-box creasing, sole wear, corner wear, brim shape. Reshaping a rigid item would misstate its condition |

## Where prints sit, and what each gets

Each kind lists the zones a print can be in (`graphic_zones`): for tops chest centre, left chest, full front, back neck, full back, sleeve, hem, plus the hood and pocket on a hoodie; for pants the back pocket patch, waistband patch, front pocket, leg and hem. Rules:

- Every print found gets its own slide. A small left-chest logo is unreadable on slide 1, so it is the one that most needs a close-up.
- The close-up is cut from the whole photo only if the cut is at least 560 px on its short side without upscaling. A 12 MP phone photo almost always has that; the 1080 px demo photos only do for big prints. Otherwise the person is asked to get close.
- A print that is only on the back makes slide 2 required: the planner asks for the back.
- The redraw is checked against every print's real close-up (below), so a print that moved, shrank, mirrored or lost a letter drops the candidate.

## Flaws, the hard part

Why it is hard: a model "cleaning up" a photo removes exactly what a flaw is (a dark spot, a broken line), a flaw is often too small to see in a whole-item photo, and a photo of a stain shows fabric, not where on the garment it is.

- **A flaw is never in a redrawn pixel that matters.** Each flaw gets its own slide made from a real photo, `as_shot`: no exposure change, no cleanup, no sharpening.
- **Location and close-up both.** If there is a close-up, it is used. If the flaw is only visible in the whole photo, a cut around it is used so the buyer sees where it is, and the person is asked for the close-up.
- **The redraw must keep it.** Flaws on the source photo are listed in the prompt ("these flaws stay exactly where they are") and the judge is asked what is lost. A candidate that loses one is dropped.
- **The cap never drops a flaw.** Past a site's cap a flaw moves to the description's flaw list, never silently.
- **Unsure flaws are not decided by the model.** The read marks each flaw sure or unsure; unsure ones go to the person to confirm (`unsure_flaws` in the read) and only confirmed ones become slides.
- **Shooting tips the capture coach can say**, by flaw kind: hold a hole up to light; shoot a stain in daylight without flash so its color is true; lay a coin or finger next to a small flaw for size (Ben's own tag photos use a quarter); shoot print cracking at a low angle so the cracks catch light.

## Tags and measurements

- The tag is never redrawn and never cut from a far photo: letters need about 16 px, so it needs its own photo at a hand's length. On every re-lay the neck tag is tucked, which stopped the model inventing tag text in 4 of 4 tries ([build plan](build-plan.md)).
- Measurements are real tape photos, never generated. The numbers go in the description, not on the photo (eBay bans text on photos).
- The re-lay's proportions are checked against the tape when the read finds a pit-to-pit and a length, with an 8% band; otherwise against the real photo's outline with a 12% band. A redraw is never used to work out a size.

## How the backend works

| Step | File | What it does |
|---|---|---|
| Read | [look.py](../../../jobs/studio/look.py) | One call to Gemini 4 Carbon through OpenRouter with every photo: role, side, zone, item box, each print with its text, each flaw with sure/unsure, tape readings |
| Plan | [plan.py](../../../jobs/studio/plan.py) | The slide set and the asks, from [slides.json](../../../jobs/studio/slides.json). Pure function, 8 tests |
| Redraw | [slides_run.py](../../../jobs/studio/slides_run.py) | Cover and back only. Inputs: the real photo, the template outline, up to two real print close-ups. Five candidates in parallel: Nano Banana 2.1 four seeds and Gemini 3 Pro Image one (Ben, 08:33: "stay on nanobanana"; Seedream 5.5 led for about an hour that morning and was reverted) |
| Check | [check.py](../../../jobs/studio/check.py) | Pixel checks: each print found again (SIFT, one homography, then correlation), color drift as drawn, proportions. Then the judge reads the candidate against the real photos for letters, invented labels and lost flaws. Then the color is pushed back to the real item's |
| Pick | slides_run.py | Of the candidates that pass, the flattest and best laid; if none pass, the real photo |
| Assemble | slides_run.py | 1080 px squares, no padding, the before-and-after sheet, a manifest with every number and `ai_marked` per slide |
| Run | [studio-touchup.yml](../../../.github/workflows/studio-touchup.yml) | `command: slides` on any branch, with the repo's OpenRouter key; commits the run to that branch, never to main |

Models on OpenRouter on 2026-11-15 (*observed*, [models.json](slides/runs/20261115-0607-43683951280/models.json) and the smoke run): Seedream 5.5 is not listed any more. Nano Banana 2.1 rendered in 6.8 s for $0.037, Gemini 3 Pro Image in 14.6 s for $0.14, GPT image 2 in 95 s for $0.24.

**Update, 2026-11-15 08:30.** Seedream 5.5 has a live OpenRouter page (`bytedance-seed/seedream-5-5`, released Nov 12, from $0.02 an image plus $0.008 per reference image, up to 10 reference images, *observed* on [its page](https://openrouter.ai/bytedance-seed/seedream-5-5)), and Runware serves it at the same price (*observed*, [runware.ai/seedream-5-5](https://runware.ai/seedream-5-5)). The slug was still missing from the models list this morning, so a call through OpenRouter is not yet proven. Ben chose to stay on Nano Banana 2.1 at 08:33, so the run leads with it. If Seedream 5.5 comes back later, Runware serves it at the same price.

## Results on the three real items

Three full runs on Ben's real photos in `assets/demo-items/real/` (all *observed*). Each run reads, plans, redraws and checks all three items on the repo's OpenRouter key; the third run is the current code.

| Run | Tee | Hoodie | Pants | What changed after it |
|---|---|---|---|---|
| [1](slides/runs/20261115-0616-43684634640/) | cover and back dropped: drawn 9 to 14% narrower than the tape, tiny "NCAA FINAL FOUR TEAM" garbled | cover dropped: invented neck tag, shape against a sprawled photo | cover kept; back dropped, Carhartt patch text changed | shape set to the tape; real print pixels pasted back; a messy photo is no longer the shape truth |
| [2](slides/runs/20261115-0638-43686352420/) | all dropped: a square patch showed around the pasted print | **cover kept** (2 of 4) | **cover and back kept** | paste only the print's ink, not its box; five candidates |
| [3](slides/runs/20261115-0652-43687372523/) | **cover kept, 5 of 5 passed**; back dropped, 5 of 5 (front neckline drawn on the back, micro-text in the 74) | **cover kept**, 2 of 5 (the others invented a neck tag or drew the dashed outline) | **cover kept**, 5 of 5; back dropped this time, 0 of 5 | |
| [4](slides/runs/20261115-0800-43692434630/) | cover kept (a second pressing of seed 4); back dropped, 0 of 5 | cover kept, 4 of 5; sleeves now laid out with floor between them and the body | **cover and back kept** (second pressings) | the model keeps most fold shading: 15, 25 and 10% gone |
| [5](slides/runs/20261115-0836-43695226533/) tee and hoodie | cover kept, 8 of 9 (with the press at 60%) | cover kept, 7 of 9 | not run | press down to 35%: 60% left blotches |

Before and after, slide 1, run 3 ([tee](slides/runs/20261115-0652-43687372523/marquette-tee/before_after.jpg), [hoodie](slides/runs/20261115-0652-43687372523/chico-hoodie/before_after.jpg), [pants](slides/runs/20261115-0652-43687372523/carhartt-pants/before_after.jpg); every candidate with its reason in each `whole_cover.jpg` and `whole_back.jpg`):

- **Tee.** Crumpled and twisted on the floor becomes flat, square and ironed on the same concrete. The width was set to the tape (21.25 in across over 27 in long; the model drew it 10% narrower), and the chest print is the real print's pixels, so "NCAA FINAL FOUR TEAM" reads as on the shirt.
- **Hoodie.** Bunched hem and splayed sleeves become a straight, symmetric lay; CHICO is the real pixels; color 1.0 CIEDE2000 from the real one as drawn. Its shape is not checked: there is no tape photo, and the real photo is too bunched to measure, so the set asks for a tape photo.
- **Pants.** Barely changed: Nano Banana kept the legs apart and only straightened a hem. Honest, but not the template lay; the pants prompt needs work.
- **Backs fall back to the real photo**, which is the rule working: no back passed in run 3.

Each item took 2.5 to 6 minutes and $0.32 to $0.64 (reads, five candidates per whole slide, a judge per candidate). Time is mostly the judge and GrabCut, not the renders.

**Planted lies on the kept redraws** ([bench_relay.py](../../../jobs/studio/bench_relay.py), [result](slides/bench/relay-lies-20261115.json), pixel checks only, no judge): 8 of 8 honest variants kept (as drawn, 8% brighter, turned 3°, 5% smaller). 13 of 16 lies dropped: print painted out, print swapped for another item's, hue turned 30° and 60°, 35% darker, mirrored, and on the tee 12% taller. On the tee a 12% wider lie was not dropped but set back to the tape, so what the buyer sees is the true shape. The 2 misses are both stretches of the hoodie, which has no tape and no flat real photo: **without a tape reading the shape is not checked, so the set asks for one.** The mirrored hoodie first passed, because C, H, I and O read the same flipped; the check now rejects flipped matches and needs the matches to span half the print.

**Measurements and wrinkles, as numbers:** [measure-proof.md](measure-proof.md). In short: the model alone drew the tee 8 to 21% narrow 15 times out of 15; every published slide read within 1.2% of the tape, because the check sets the width to the tape.

## What is not done

- Flaws: none of the three items has one, so the flaw path ran only in tests. Pasting a flaw's real pixels back the way prints are is not built; the judge is the only check that a flaw survived a redraw.
- Pants lay: the model keeps the legs as shot. Try the template outline at a higher weight, or a prompt with the legs described one by one.
- Backs: the model draws a front neckline on a tee's back. Add "this is the back: the neckline is high and nearly straight" to the back prompt.
- Order on eBay and Etsy: [card 21](../../../spec/determinations/seeing-the-item.md#21-which-frames-become-listing-photos-and-in-what-order) puts the real true-color front first; this set puts the redraw first. Proposal: redraw first on Depop, Poshmark and Mercari, real first on eBay and Etsy. Ben's call.
- No screen yet: the approval card for a redrawn slide is specified in [studio](../../../spec/features/studio.md) and not built here.

Run it: `command: slides` on the `studio touch-up test` workflow, any branch; or `OPENROUTER_API_KEY=... python3 jobs/studio/run.py slides <items dir> <out dir>`.
