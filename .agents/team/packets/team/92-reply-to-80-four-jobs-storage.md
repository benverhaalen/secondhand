# 92: reply to 80, the four jobs' storage, what is built

Updated: November 15, 2026. Owner: Ben. For: Ben. From: Nate's side. Agent: Claude Code (an Opus seat for Nate's server lead). Status: built and tested on a main the diff.

This answers the three server items in [packet 80](80-new-four-jobs-storage.md). The code is in commit fe281abb (`feat(api): a capture's intent, the person's lookups, and a want that keeps what the camera read`).

## What is built

1. **`capture.intent`**, one of `sell`, `worth`, `track`, `find`; `sell` when left out. POST /v1/captures checks it and any other value gets 400. Every capture read returns it (`app/src/edge/api/captures.ts`).
2. **The person's lookups.** `GET /v1/lookups`, `DELETE /v1/lookups/:capture_id`, `DELETE /v1/lookups` (`app/src/edge/api/lookups.ts`, listed in `GET /v1/routes`). A row is a capture of the caller's whose intent is `find` or `worth`. Rows come newest first and only ever the caller's.
3. **A want that keeps what the camera read.** POST /v1/wants takes optional `product_id` and `capture_id`. Both must look like an id (`prefix_` and letters or digits). A `capture_id` that is not one of the caller's captures gets 404. Both are stored on the want and returned (`app/src/edge/api/wants.ts`).

## Shapes, one example each

Capture with an intent:

```
POST /v1/captures
{"mode": "shots", "purpose": "find", "intent": "find"}
-> 201, and GET /v1/captures/:id now includes  "intent": "find"
```

Lookups:

```
GET /v1/lookups?limit=20
-> 200
{"data": [{"capture_id": "cap_3n9q", "kind": "find", "product_id": null,
           "short_name": "Levi's 501", "at": "2026-11-15T12:40:00Z"}],
 "next_cursor": null}
```

`limit` is 1 to 100, default 20. Any other value gets 400. `short_name` is the brand and model the camera read, then the item type, then the suggested family, then `item`. `product_id` is always `null` today because nothing links a capture to a product yet. `next_cursor` is always `null` because there is no paging past the limit.

```
DELETE /v1/lookups/cap_3n9q   -> 204
DELETE /v1/lookups            -> 204
```

A deleted lookup leaves the list, and its capture stays. Each of these gets 404: an id that is unknown, already deleted, a sell capture, or someone else's. Someone else's gets 404 rather than 403 so the answer does not show that the capture exists.

A want from the camera:

```
POST /v1/wants   (Idempotency-Key required, as before)
{"text": "brewers jersey", "max_total_cents": {"amount_cents": 6000, "currency": "USD"},
 "sites": ["ebay"], "alert": "available", "capture_id": "cap_3n9q", "product_id": "prd_501"}
-> 201, the want with "capture_id" and "product_id" as sent
```

## What spec/redesign/new-results.md asks for that is not built

- **The latest valuation per row.** The row has no range yet. Valuations are not joined to captures, and SV6 (pricing the item the request names) is the engines lead's EN6.
- **The 90-day age-out.** Nothing drops old lookups. Captures are held in the server's memory and are lost on restart until SV1 persists capture rows.
- **A lookup dropping when it becomes an item or a want.** Nothing links them yet, so a lookup stays listed until it is deleted.
- **Keep it and Sell this from a lookup.** These need the existing item routes wired to a capture, and that is not done.
- **Remembering the last job used on +.** This is not stored on the server. It belongs to the app or to `/v1/me` settings, and neither has it.
- **Changing a capture's intent when the mode switches.** PATCH /v1/captures/:id does not accept `intent`, so the intent is set once, when the capture is created.
- **"Kept" does not exist.** No item or capture state says an appraisal was kept or sold. So every find or worth capture is listed until it is deleted. Nothing was invented to stand in for it.

## One thing for you to know

Captures already have a required `purpose` (`sell`, `appraise`, `find`), which drives the capture's questions. `intent` sits next to it, as packet 80 asked. The two overlap: `worth` is `appraise`, and `track` has no `purpose`. Whether one should replace the other is open, *agent proposal*: keep both until the capture lead says which one the questions should read.
