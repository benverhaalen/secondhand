# 55 — Studio slides backend: what Nate's side needs to know

Updated: November 15, 2026 07:20 UTC. Owner: Ben. Agent: Claude Code, project thread "Perfect every listing photo automatically". Branch: `claude/project-thread-s8jxr7` (PR to main). Status: built and run on the three real items; for Nate's backend.

## Scope

A few casual photos of one item in; an ordered, checked listing slide set out. Code in `jobs/studio/`, spec as data in `jobs/studio/slides.json`, write-up in [research/studio/ben/slides.md](../../../../research/studio/ben/slides.md).

## Affected interfaces (backend)

- **Job.** `jobs/studio/slides_run.py:run_item(folder, out)` is the whole job for one item. It fits the `studio` job kind in [spec/features/studio.md](../../../../spec/features/studio.md): stages are read, plan, redraw, check, assemble. Not wired to the edge or Lakeflow yet.
- **Output.** `manifest.json` per item: the vision read, the plan (`slides`, `asks`, `notes`), per slide `{slot, type, photo, crop, route, how, ai_marked, model, seed}`, every candidate's check numbers and judge answer, per-site cuts (`for_site`), cost and seconds. `ai_marked` is true only on a redrawn cover or back; it maps to `export.py`'s `relay` route.
- **Asks.** `plan.asks` lists shots the set cannot make honestly (no back, a print too small to cut, a flaw only seen far away, no tape photo). Capture and the decision queue should surface these.
- **Keys and models.** OpenRouter only. Read and judge: `google/gemini-4-carbon`. Renders: `google/gemini-nano-banana-2.1` ×4 seeds and `google/gemini-3-pro-image` ×1. Seedream 5.5 is no longer on OpenRouter's model list (observed 2026-11-15). Cost per item $0.32 to $0.64, 2.5 to 6 minutes, mostly the judge.
- **Running it.** The `studio touch-up test` workflow takes `command: slides|smoke|models` on any branch, uses the repo's `OPENROUTER_API_KEY` secret, and commits runs to that branch (never main). It fails closed if an output contains the key.
- **Honesty.** Only cover and back may be redrawn. A candidate is dropped if a print is not found as it is (or only flipped), the item color drifted past 10 CIEDE2000 as drawn, the shape is off the tape by more than 8%, or the judge finds changed letters, an invented label or a lost flaw. Prints are pasted back from the real close-up; width is set to the tape. Planted lies: 13 of 16 dropped, 1 set back to the tape, 2 shape lies missed on an item with no tape; 8 of 8 honest kept.

## Next action

Nate: decide where the job runs (Lakeflow worker or the edge) and wire `asks` and `ai_marked` into the item record. Ben: the eBay and Etsy cover order (open in slides.md).

## Evidence

Runs: `research/studio/ben/slides/runs/20261115-0652-43687372523/` (current), `-0638-…`, `-0616-…`. Bench: `research/studio/ben/slides/bench/relay-lies-20261115.json`.

## Update, 2026-11-15 08:30 (thread "Quantify every feature with why and ROI")

- **Renders now lead with Seedream 5.5** (Ben asked again at 08:09): `jobs/studio/slides_run.py` runs four Seedream 5.5 seeds and one Nano Banana 2.1 fallback; `openrouter.IMAGE_PREFS` lists Seedream first. The OpenRouter page is live but the slug was missing from the models list this morning, so the first real run tells us whether OpenRouter serves it; if not, Runware is the next host (same $0.02 an image).
- **No tape, no redraw.** `jobs/studio/check.py` now drops every whole-item redraw that has no tape reading (Ben: "can only ai beautify if you have dimensions"). The photo-outline comparison is still reported, as a number only. Tests: `jobs/studio/test_check.py`.
