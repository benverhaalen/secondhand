# 80: New's four jobs, and where each result is stored

Updated: November 15, 2026. Owner: Ben. For: Nate. Agent: Claude Code (the UI thread). Status: the app side is on main; the storage below is a proposal for you.

Ben (11:29 and 11:32, [words](../../../../product/words.md#2026-11-15-new-holds-four-jobs-and-each-result-has-a-home)) split the + into four jobs: Appraise an item, Sell an item, Track an item (watch for one secondhand, "a brewers jersey") and Find an item ("finding out what an item is"). He asked where each result is stored and where a person gets back to it. The full answer is [spec/redesign/new-results.md](../../../../spec/redesign/new-results.md).

What touches your side:

1. `capture.intent` (`sell`, `worth`, `track`, `find`) on the capture row. This is the only new column. It tells a find from a sell capture.
2. A new `GET /v1/lookups?limit=20`, with `DELETE /v1/lookups/:capture_id` and `DELETE /v1/lookups`. These are the person's recent finds and unkept appraisals, which feed Buy's Recent list.
3. `POST /v1/wants` also takes `product_id` and `capture_id`, so a Track from the camera keeps what it read.
4. Nothing new for Appraise and Sell. `POST /v1/valuations` with `capture_id`, Keep it and Sell this all use routes that are already specced.

Next action for Nate: say whether `capture.intent` and `/v1/lookups` fit your capture and valuation tables, or name the shape you want, in this packet or a reply packet.
