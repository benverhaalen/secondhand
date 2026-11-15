# 97: the whole plan from here, for Ben

Updated: November 15, 2026, 14:26 UTC by the machine clock (times the orchestrator wrote from memory since 13:50 UTC, here and in packets 84, 94 and 95, run up to fifteen minutes fast). Owner: Ben. For: Ben. From: Nate's side (the orchestrator, Claude Code). Status: the plan Nate's side is working to until judging at 19:00 UTC, and after it. Nate asked for this packet ([words](../../../../product/words.md#2026-11-15-nate-a-full-packet-of-plans-for-ben-then-back-to-building-and-wiring-the-backend)).

Read this one; it replaces having to read 84, 92 to 96 in order. Section 5 is what we need from you.

## 1. Where things stand, as the orchestrator has seen them run

The kept table is [finalization §13](../../../../spec/plans/finalization.md#13-what-works-kept-by-the-orchestrator). In short:

| Works, seen | Does not work yet |
|---|---|
| Sign-in by email code on the dev server; the session survives reloads | Sign-in on the hosted server: no email sender is set there |
| Search signed out and signed in: four sources, 100 to 350 listings a search, first rows in 0.6 s, a photo and a real title on every row, prices in dollars (benchmark at 14:15 UTC: 16 of 16 queries, top ten on target 0.93) | The full answer settles at 8 s median; the target is 5 s |
| Your four tabs and Messages reading owned data, empty for a new person; `/v1/lookups` | The chat after a search: `POST /v1/assist` is still example data |
| One person's whole path through the server as a test (`server/journey.test.ts`): sign-in, lists, search, capture, want, delete, restart, with a second person who sees none of it: 10 steps pass | A photo taken in the app reaching identify and Lens: the app stops at the upload (section 3b). Your model was right |
| The app built for the iOS simulator in Release and walked (packet [96](96-native-walks-handoff.md)) | The hosted server: deployed at `https://secondhand-api.fly.dev`, but Fly's trial stops the machine five minutes after each start |

The full check on the Mac had 34 failing tests after your onboarding merges. The ten rendered checks, the capture file and the server tests under your merges are fixed on main since (20e81634, 977c2ebd, f5fb5a3e, afd36f44; the server lead's packet [95](95-server-tests-after-ben-onboarding.md) says what it changed in your merge). The next full run is ours to do.

## 2. How Nate's side works from now

Nate stopped the parallel leads at 14:25 UTC: they were merging on top of each other. Now:

- **One merger on our side.** Only the orchestrator merges our work to main, one change at a time, through its own worktree. Work that passes its checks lands at once and is reviewed after; only sign-in, money, deletion and paid outside calls get a review first.
- **Your merges are yours.** We do not edit your screens. When a fix of ours has to touch a file of yours we say so in a packet (so far: `app/src/buy/insights.ts`, one line; the app fixtures in `.agents/checks/render.test.mjs`).
- **Two hooks**, on in our clones, one line to turn on in yours: `git config core.hooksPath .agents/hooks`. They refuse a commit, merge or push that sets a file back to an older copy of itself (a stale copy undid eighteen server files this morning). A revert you mean: `STALE_OK=1`.
- **After judging, with you stopped:** the history rewrite Nate ordered (packet [82](82-history-rewrite-for-ben.md)). Every clone is thrown away and cloned again; you ask GitHub Support to purge the pull-request refs.

## 3. The build order until judging

Each is landed by the orchestrator when its check passes. The contract is what your client can build against now.

**a. The chat answers.** `POST /v1/assist`, visitor or signed in. Request `{surface:'buy', text (2,000 at most), history? (10 turns at most), search_job_id?}`. It answers `202 {id, kind:'assist', state:'running', stages, stream}`; the stream carries `assist.tool` (no input shown), `assist.text {delta}`, `assist.settled` with the answer's blocks, then `job.state`. `503 unavailable` when the host has no model key, `429 rate_limited` with `extra.cap:'daily'` at the visitor cap. Your `app/src/buy/chat/assist.ts` already folds these frames. Prices in an answer come as widget blocks drawn from the rows; prose carries a figure only when a cited row holds it.

**b. A photo reaches identify.** Today `POST /v1/captures/:id/photos` answers with an example upload address and your client stops, correctly, at "Photo uploads are not connected yet". Landing in this order: the photos route hands out a real single-use address under `PUT /v1/uploads/:id` (JPEG or PNG, 25 MB, read by its bytes, metadata stripped); `POST /v1/captures/:id/finish` starts identify as a job and answers with it in `jobs`; candidates and the next questions arrive on the capture row. The identify engine is on main (b56afe79). What your screen calls and what comes back is in [capture.md §4 and §5](../../../../spec/engines/capture.md#4-what-bens-screen-calls). The paid Lens step sits behind identify: it runs only when the tag, label and barcode reads abstain, and only once Nate tops up the account and says go.

**c. One question widget for capture and for the chat.** Nate: "I think we can add those clarifying question widgest to the intelligent ui too". One block, `Ask`: `{id, field, kind, words, options [{value, label?, proposed, rests_on?}], other, max_length?, unit?, units?, parts?, why, answer {method, path}}`, type exported from `app/src/engines/capture/plan.ts`, described in capture.md §4. Capture sends it on the capture row; the chat sends it as a block in `assist.settled`. One drawn part for both, please.

**d. Routes that claim work they do not do** (your packet 91; owners in packet [95](95-reply-to-91-who-has-each-contract.md)): a saved want is run on the server's tick or says it is not watching; `GET /v1/insights` stops serving the example to a real person; the decision act route stops marking an unmapped kind answered.

**e. Search.** The settle time back to 5 s; eBay read from a US address so its prices are dollars; `shipping_cents`, `brand`, `size`, `condition` and `listed_at` carried in the result (the rows hold them since bcd35ce1; the result still writes `shipping_cents: null`).

**f. The hosted server.** Waits on Nate for three things: a card on the Fly account (the machine then stays up), an email sender key (`RESEND_API_KEY`, `SECONDHAND_EMAIL_FROM`), and a model key with a daily cap. Then we walk it and your release build, which already points at it, can sign in.

**g. Databricks.** The guard alert moves to daily after 19:00 UTC; the retail views and the Genie space are read back healthy.

## 4. What your screens can rely on today

- Sign-in: `POST /v1/auth/email/start`, `/verify`, `/refresh`; `GET` and `DELETE /v1/me`. Deleting an account now removes the person's captures too (59b9e3ad).
- Search: `POST /v1/search` answers a job; `GET /v1/jobs/:id/events` streams it and closes itself. A visitor must send back the `X-Visitor-Id` the server returns: it is signed, and an id you make up is replaced. Each result row may carry `image_url`; Depop rows have a title from the listing's text.
- Lists: `/v1/today`, `/items`, `/orders`, `/wants`, `/conversations`, `/events`, `/lookups`, `/accounts`, `/decisions`, `/follows`, `/rules` answer 200 and empty for a new person.
- Captures: `intent` (sell, worth, track, find) beside `purpose`; `GET` and `DELETE /v1/lookups` (packet [92](92-reply-to-80-four-jobs-storage.md)).
- What a screen must not show as real yet is the right-hand column of packet [95](95-reply-to-91-who-has-each-contract.md).

## 5. What we need from you

1. The seven layout and labelling defects from the web walk (packet [94](94-web-walk-defects-for-ben.md)): parts drawn over each other on the services step and in search results, buttons with no name for a screen reader, the cut placeholder.
2. One drawn part for the `Ask` block (3c), used by capture and by the chat.
3. Your ruling on the posting question with Nate: a live post on five sites, or monitor only. It decides whether any write leaves dry mode.
4. The shop's look and the white screen inside a dark app (packet [81](81-search-reach-for-ben.md)).
5. Say if you want either of our two edits in your area done differently (section 2).
6. When you merge: pull main first, and tell us in a packet when a merge changes a route's behaviour, so its tests change in the same hour.

## 6. Where to look

- The fixes by area, the open list for Nate, the reruns and the kept table: [the finalization spec](../../../../spec/plans/finalization.md) (sections 9, 12, 13).
- The audit it rests on: [audit-2026-11-15.md](../../../../spec/plans/audit-2026-11-15.md).
- The rules our leads work by: [packet 55](55-team-leads-and-mac-workers.md).
