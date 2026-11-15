# 95: reply to 91, who has each of your ten blocking contracts

Updated: November 15, 2026, 14:12 UTC. Owner: Ben. For: Ben. From: Nate's side (the orchestrator, Claude Code). Status: a map of owners. Nothing here is a promise of a time.

Your packet [91](91-ben-live-data-and-site-handoffs.md) traced ten places where the code under your screens does not yet do what a screen would claim. All ten read as right to me against the code. This says who on our side has each, and what you can show today.

| Yours, in 91 | Who has it | What a screen can show today |
|---|---|---|
| 1. Inbox readers return metadata, not message bodies | search lead (the site harnesses) | the thread list with counterpart and time; no message text |
| 2. Signed-in offers, orders, inbox and stats are fixture-proven; eBay's private readers are not composed | search lead; it needs one linked account, which waits on Nate | nothing as this person's own until an account is linked |
| 3. Own-listing reads omit size, condition, category, colour | search lead. Depop's search reader now returns them (e45dd58e); the own-listing reader is separate | title, photo and price |
| 4. Write adapters are dry plans; the decision route can mark a kind answered with no operation | server lead for the route, search lead for the adapters. Every write stays dry by Nate's rule until he says go per site | your site handoffs, as you built them: right |
| 5. Offer expiry is computed from a platform rule, and dropped in the snapshot | search lead | no countdown, as you chose |
| 6. `sold.ts` uses `listed_at` when `sold_at` is missing and calls it the sale time | engines lead, told today; it changes what a valuation's observation time means | sold comps as they are; the fix lands in the engine |
| 7. `read_stats` is not collected; `GET /v1/insights` serves the example snapshot | server lead (the route), Databricks lead (the history) | do not show insights as this person's results |
| 8. Valuation: observations are not persisted, a result finishes a job and does not update the item, and `/v1/lookups` had no route | `/v1/lookups` is on main (530a217f, packet 92). The rest: engines lead and server lead (the observation writer is built on a Mac branch, not merged) | the returned range and its citations; no history |
| 9. Unknown-fee orders are dropped by the front end's order projection | yours | "Net pending" once the nullable amounts are carried through |
| 10. Wants persist but `runWant` is not composed in the runtime | server lead, told today | "saved", never "watching" |

Two things from our walk that touch the same ground are in packet [94](94-web-walk-defects-for-ben.md): about twenty server tests went red under your merges, and the server lead is settling which side of each is right.

What would help us from you: a line on any of the twenty that you changed on purpose, and whether you want the two fixes we made in your area kept (the price summary's currency in `app/src/buy/insights.ts`, and the app fixtures in `.agents/checks/render.test.mjs` now drawing the wordmark top left as `brand/media.json` says).
