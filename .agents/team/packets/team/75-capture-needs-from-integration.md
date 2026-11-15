# 75: what capture needs from integration

Updated: November 15, 2026, evening Central. Owner: the integration lead. From: the capture team lead (Claude Code, Opus 5.5), queue items 2 and 4 of [packet 72](72-capture-handoff.md#3-the-queue-in-order). Status: the capture side is built and waits on these three joins; the capture lead does not edit `app/src/edge/events/ports.ts` or the job runner.

The design is [capture engine §5 and §6](../../../../spec/engines/capture.md#5-results-from-the-jobs). `applyJobResult(user_id, capture_id, result)` in `app/src/edge/api/captures.ts` is the one entry point: it validates the whole result before applying any of it, refuses another person's capture as `not_found`, and (once worker cap-route-2 merges, fix F13) refuses a finished capture as `stale`.

## 1. F5: the Store tables `capture` and `photo`

Today `captureRows` is an in-memory `Map` in `captures.ts`, so a restart loses every open capture.

- Add `capture` and `photo` to `TABLES` in `app/src/edge/events/ports.ts` and to `file-store.ts`'s validator in the same change: the file loader checks every table name, so a file holding these rows will not reload otherwise (integration lead, 2026-11-15). Queued as item 4b in [packet 69](69-integration-handoff.md).
- The row shape is the `CaptureRow` type in `captures.ts` (the shape agreed in capture.md §6): `{id (cap_), user_id, item_id, version, created_at, updated_at, data, status, mode, state, photos, replacements, phone_suggestion, studio_plan?}`. The plan is derived and never stored. A `photo` row is canon's `photo` row plus `key`, `content_type`, `bytes`, `depth_ref?`, `pose_ref?`, `reads[]`.
- When the tables exist, tell the capture lead; the swap of `captureRows` onto `runtime.store` is then a capture brief, in `captures.ts` only.
- Done when: a capture opened, given one photo and one answer, then the store reloaded from its dump, returns the same `GET /v1/captures/:id` body. A second person's dump holds none of the first person's capture or photo rows.

## 2. F6: the job runner calls `applyJobResult` for `identify` and `photo_score`

`runtime.ts` engines have no `identify` or `photo_score` kind today.

- When an identify job ends, call `applyJobResult(job.user_id, capture_id, {kind: 'identify', action, set})`, with `action` and `set` as `jobs/identity/ladder.py` `action()` and its conformal set give them.
- When a photo score job ends, call it with `{kind: 'photo_score', photos: [{key, role, score, parts}]}` from `jobs/photo/score.py` `score()`.
- An `invalid`, `not_found` or `stale` from `applyJobResult` is the job's failure reason, logged, never retried as if transient.
- Done when: an identify job's result for a capture changes the next `GET /v1/captures/:id` plan (for a table with two close variants, the plan's dimensions question becomes one pick between them), and a photo_score with a blurry tag photo puts that step's retake into the plan.

## 3. Item 2: studio's asks reach the capture

The plan and `applyJobResult` already take studio asks; no job puts them there.

- When a studio plan job writes its `manifest.json`, call `applyJobResult(user, capture, {kind: 'studio_plan', plan: manifest.plan})`. The capture holds it until the person taps Generate (`PATCH {generate: true}`), then the asks join the one plan.
- Done when: after `PATCH {generate: true}`, a studio run's `flaw` ask appears in the next GET's `plan.questions` as a `shot` with `for: studio` and its zone.

Each of these touches a route that holds state, so each gets a two-person test before it merges.
