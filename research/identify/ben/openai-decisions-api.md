# How should image judgements use the OpenAI Decisions API with a human in the loop?
Researched 2026-11-14 by Ben (Claude Code). Feature: identify.

## What it is

- `POST /v1/decisions`. Body: `model`, `input` (text, `input_image`, `input_json`), `questions` [observed, official guide via summary: https://developers.openai.com/api/docs/guides/decisions].
- Three question types: `predicate` (returns `probability` 0–1), `choice` (returns `choice`, `probabilities`, `confidence`; 2–255 choices per a third-party read of the reference), `score` (2–10 ordered `levels`; returns a probability-weighted `score`, `probabilities`, `confidence`).
- Up to 400 questions per request. Images can sit inside a question's `instructions`, so a question can compare a candidate image against reference images.
- Model `gpt-6-luna`; $0.10 per 1M input tokens, output not charged [observed on both the guide summary and https://lilting.ch/en/articles/openai-decisions-api].
- **No rationale field and no built-in human-review feature.** OpenAI recommends thresholds from labelled examples and an `other` choice routed to review [observed, via a summary].
- Conflicts to check before building: whether public image URLs work or only base64 (third-party says use base64); whether it is GA or still beta; cache pricing.

## Why it fits secondhand

Most of our AI judgements are classifications, not prose: is the tag legible, which category, how bad is this stain, does the render still show the stain. Typed answers with probabilities make each judgement **inspectable and thresholdable**, which is exactly what human-in-the-loop needs. It is also cheap enough to run on every photo.

## Recommended question set (one call per stage)

| Stage | Question | Type | Threshold → action |
|---|---|---|---|
| Capture | `whole_item_visible`, `label_legible`, `in_focus` | predicate | < 0.7 → retake prompt |
| Identify | `category` (top, pants, dress, shoes, bag, electronics, furniture, other) | choice | `other` or confidence < 0.6 → ask user with chips |
| Condition | `condition` (new with tags, like new, good, fair, poor) | score | show the distribution; user picks, default = argmax |
| Defects | `defect_present` per region; `defect_severity` | predicate, score | any > 0.4 → ask user to confirm and shoot close-up |
| Fidelity gate | `render_preserves_defects`, `render_same_item`, `render_color_matches` (render + originals as references) | predicate | any < 0.85 → discard render, regenerate or drop |
| Selling | `channel` (eBay, Poshmark, Depop, Marketplace local, donate) | choice | always shown; user taps |

## Transparency pattern

The Decisions API gives numbers, not reasons. Two options: (a) show the question and the probability bar directly ("Tag legible: 34%, retake?"), which is honest and needs no extra call; (b) for the few user-facing decisions that need words, a second short Responses call writes one sentence of explanation. Use (a) by default [inferred].

## Calibration loop (also a Databricks story)

Every user override (said "good", model said "fair") is a label. Store question, image, probabilities and the human answer in a Delta table and recompute thresholds per question. Even 30 labelled items from the team's own closets before the demo gives defensible thresholds [inferred].

## Alternatives

- Databricks `ai_decide` (Beta) has the same predicate/choice/score shape but the docs list no image input [observed, https://docs.databricks.com/aws/en/large-language-models/ai-functions]. Use it for text-only decisions inside batch SQL (e.g. classify comps).
- Plain structured outputs on the Responses API give rationale but no calibrated probabilities.
