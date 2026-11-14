# How should secondhand be built, capability by capability, as of Nov 2026?
Researched 2026-11-14 by Ben (Claude Code). Feature: cross-cutting.

For MadHacks. One note per capability, filed under its feature slug. Each has: what exists (closed and open source), what we adapt, the recommended architecture, and risks. Claims are marked per [research/README.md](../../README.md): *observed*, *asserted* (vendor claims, third-party tests, or from memory, said which), *inferred*.

| # | Note | Capability | One-line recommendation |
|---|---|---|---|
| 1 | [capture/guided-shot-list.md](../../capture/ben/guided-shot-list.md) | Shot-list onboarding | A fixed per-category shot list with live checks, so the user never decides what to shoot. |
| 2 | [measure/measuring-garments.md](../../measure/ben/measuring-garments.md) | LiDAR and measuring | Scale from LiDAR depth or a credit card, points from a vision model, then the user drags to confirm. |
| 3 | [identify/openai-decisions-api.md](../../identify/ben/openai-decisions-api.md) | OpenAI Decisions API | Every image judgement is a typed question with a probability; low confidence goes to the human. |
| 4 | [studio/seedream-relighting.md](../../studio/ben/seedream-relighting.md) | Seedream 5.5 relighting | Correct color first, generate from all angles, then reject any render that drifts from the real item. |
| 5 | [list/posting-browser-use-ebay.md](../../list/ben/posting-browser-use-ebay.md) | Posting to marketplaces | eBay through its official API; Browser Use V4 for sites with no API, always behind an approval with live view. |
| 6 | [watch/exa-alerts.md](../../watch/ben/exa-alerts.md) | Price and availability alerts | Exa Monitors find new listings; our own code applies the price threshold. Test marketplace coverage first. |
| 7 | [data/databricks.md](../../data/ben/databricks.md) | Databricks | The system of record and the glass box: every agent step is an MLflow trace the user can open. |
| 8 | [replay/pavlo-marketplace-harnesses.md](../../replay/ben/pavlo-marketplace-harnesses.md) | Pavlo | Browser Use explores each marketplace once; Pavlo replays it as signed, sub-second API calls. |
| 9 | [measure/object-capture.md](../../measure/ben/object-capture.md) | Apple Object Capture | 3D and dimensions for rigid items (shoes, bags, electronics, furniture); not for clothes. |

Pricing and market value (including garage-sale appraisal) moved to its own thread and is not covered here.

## Principles applied

From Pavlo's principles, summarized (`research/replay/ben/pavlo-marketplace-harnesses.md`) and this repo's `.agents/coordination.md`:

- **Discover once, replay deterministically**; spend model calls on exploration, not every run.
- **Every action leaves a verifiable record** that says what it does not prove.
- **The worker never decides it is done**; a separate checker does (the fidelity gate in `research/studio/ben/seedream-relighting.md`, the Decisions thresholds in `research/identify/ben/openai-decisions-api.md`, the human in the approval inbox).
- **Budget governance**: cost caps per run (`maxCostUsd` in Browser Use; one render retry).
- **No masking automation, no server-side credentials** (Pavlo principle), which conflicts with Browser Use Cloud. See `research/replay/ben/pavlo-marketplace-harnesses.md` for the options.
- **Exact sources, observed vs interpreted, humans decide conflicts** (coordination.md).

Ben mentioned a thesis on AI agents worked on last night. It isn't on GitHub (I checked his repos); if it's on his Mac, the next pass should read it and adjust these.

## The whole system in one picture

```
 phone (capture)            backend agents                         outside world
 ───────────────            ──────────────                         ─────────────
 shot list ──photos──▶  [Decisions] quality / category / defects
 depth or card ─────▶   [Measure]  points + scale ──▶ user drags ✓
                        [Color]    white balance from tag/card shot
                        [Seedream] studio / garage / home renders
                        [Decisions] fidelity gate: render vs real ──▶ reject or keep
                        [Price]    comps (eBay Browse + Exa) ──▶ "you keep $X"
                        ── draft listing ──▶ APPROVAL INBOX (human) ──▶ eBay API
                                                                 └──▶ Browser Use (live view)
                        [Exa Monitors] buyer-side alerts ──▶ webhook ──▶ notify
 every step above ──▶ MLflow trace + Delta row in Databricks ──▶ "why?" panel in the app
```

## Decisions that cut across files

1. **Real photos are evidence; renders are presentation.** eBay's picture policy forbids "Photos that don't accurately represent the item" and "Stock photos for used, damaged, or defective items" [observed, https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370]. It says nothing about AI images, so a regenerated photo of a used item is a policy risk [inferred]. Every listing therefore leads with real photos (corrected only for exposure and white balance) and adds renders as labelled extras, and every defect photo stays unedited. This is also the strongest transparency story for judges.
2. **Probabilities drive the human loop.** The Decisions API returns `probability`, `probabilities` and `confidence`, with no rationale field and no built-in review queue [observed, via a summary of the official guide]. We set thresholds; below them, the item lands in the approval inbox with the evidence that caused it.
3. **Official APIs before browser agents.** eBay has a documented Inventory API and a GraphQL Listing API with a `VALIDATE` dry run [observed]. Browser Use is for sites without an API, where it is slower and riskier (terms of service, bot checks).
4. **Explore with a browser agent, then replay.** Browser Use is the explorer and the fallback; Pavlo harnesses do the repeated work (`research/replay/ben/pavlo-marketplace-harnesses.md`).
5. **Nothing public without a human tap.** Posting, price changes, offers and buyer messages all go through one approval inbox. Rules can pre-approve routine items (the Monarch "only exceptions reach the inbox" pattern in `secondhand-concept/research/adjacent-references.md`).

## Suggested build order for a 24-hour hackathon

1. Capture flow + Decisions quality checks (the demo opens here).
2. Draft listing + approval inbox + eBay `VALIDATE` dry run (end-to-end skeleton).
3. Seedream renders with the fidelity gate.
4. Measurement (card scale first; LiDAR if someone ships Swift).
5. Databricks traces surfaced as the "why?" panel.
6. Browser Use posting to one non-API site, live view on screen; then capture it as a Pavlo harness and replay it.
7. Exa buyer alerts.

Stop after any step and there is still a working demo.
