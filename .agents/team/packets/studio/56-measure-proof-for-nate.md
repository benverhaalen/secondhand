# 56 — Studio: the re-lay only when measured (LiDAR), the tape check on redraws, and the press

Updated: November 15, 2026 08:50 UTC. Owner: Ben. Agent: Claude Code, project thread "Perfect every listing photo automatically". Branch: `claude/project-thread-s8jxr7` (PR to main). Status: built and run on the real tee and hoodie; follows [55](55-slides-backend-for-nate.md).

## Scope

Ben asked for proof that a redrawn photo keeps the item's real size, using the item's tape measurements. Write-up and results: [research/studio/ben/measure-proof.md](../../../../research/studio/ben/measure-proof.md).

## Affected interfaces (backend)

- **Rule (Ben, 09:00 and 09:09): the re-lay runs only from the LiDAR flow.** `plan.relay_measured` allows a redraw of the cover and back only when the item has `pit_to_pit` and `length` (tops) and `measured_by == "lidar"`; a tape photo or typed number does not open it. Testing waits until LiDAR capture works. Otherwise the whole photo is touched up where it lies. Pants are touch-up only until the ruler reads them.
- **New modules.** `jobs/studio/measure.py` reads pit to pit and length off a flat top's outline the way a tape does, and tests them against the measurements (`against_tape`). `jobs/studio/proof.py <run> <items> <out>` writes the proof pictures and numbers.
- **Measured numbers.** In the app they come from the capture's LiDAR frame. In test runs an item folder's `tape.json` (`{"length": 27.0, "pit_to_pit": 21.25}`) stands in, else what the vision read off tape photos. The job reads them as `look["measured"]`.
- **Manifest additions.** `tape` (inches and source), `measure_audit` (phone photo, redraw as drawn, published slide: inches read and error against the tape), per candidate `pass` (1, or 2 for a second pressing), `from`, and `numbers.wrinkle` (`left` is the share of the photo's fold shading still there). The slide records `cand`, `pass` and `from`.
- **Behavior changes.** The smoothest passing redraw wins (was the judge's flat score). The two smoothest get a second model pressing, checked again from scratch. Tops then get a deterministic press (`check.press`, lightness only, prints and hue untouched) before the judge. The judge now also answers `wear_kept` and blocks a redraw that removed fading or wear. Cost per item rose to about $0.48 to $0.92 (8 to 9 renders plus judges).
- **Capture (for the capture side).** The LiDAR measuring frame must be the flat lay: LiDAR gives scale and depth, not fabric folded underneath.

## Next action

Nate: put the capture's LiDAR measurements on the item as `measured` (`pit_to_pit`, `length`, `sleeve`), pass them to the studio job, and keep `measure_audit` with the slide set so the listing page can show it.

## Evidence

Runs: `research/studio/ben/slides/runs/20261115-0800-43692434630/` and `-0836-43695226533/` (press at 60%, since lowered to 35%). Proof sheets: `research/studio/ben/slides/proof/`. Tests: `jobs/studio/test_measure.py`, `jobs/studio/test_plan.py`.
