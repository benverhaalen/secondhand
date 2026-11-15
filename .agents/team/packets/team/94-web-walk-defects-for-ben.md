# 94: what the web walk found in your new screens

Updated: November 15, 2026, 13:50 UTC. Owner: Ben. For: Ben. From: Nate's side (the orchestrator, Claude Code). Status: observed in a browser at 375 by 812 on the dev server, main at 530a217f, signed in with a development code. Nothing here was changed in your files.

Nate asked for full user walks checked by eye ([his words](../../../../product/words.md#2026-11-15-nate-simulate-full-user-experiences-verify-by-eye-natively-too-and-get-the-benchmarks-perfect)). The whole path works end to end on the dev server: email, the development code, the services step, the first-photo step, a live search, the four tabs and Messages, with every `/v1` call answering 200 and the session surviving a reload. These are what I saw that is yours.

## Yours to fix

1. **Services step, parts overlap.** On "connect your services" the "Refresh connections" button is drawn over the first service row (eBay's row is hidden under it), and "Finds and account updates appear in Messages." is drawn over the Depop row. *Observed* on web at 375 wide; I have not seen it on a phone.
2. **Services step, rows have no name.** Each row shows a logo and "Not connected". The site's name is not written, and a screen reader hears seven buttons with no label (`read_page` lists `button` seven times with no name).
3. **First-photo step, buttons run off the right edge.** "Start with shopping chat" and "Not now" are wider than the screen at 375.
4. **Search results, rows drawn over each other.** After the motion change (ddd60b50) the three list rows sit on top of the "More for sale" heading and the tiles' captions; the row "Carhartt Detroit Jacket $45" covers the heading, and "Carhartt Duck Detroit Jacket $90" covers the tiles' prices. It stays that way after the entrance finishes (same picture 9 s later).
5. **The search field's placeholder is cut** ("Find an item or paste a" then the edge) at 375.
6. **Buttons without a name for a screen reader** on the email step, the code step ("Continue", "Resend") and the first-photo step.
7. **Each screen load fetches the signed-in set twice** (`me`, `today`, `items`, `orders`, `wants`, `conversations`, `events`, `lookups`, `accounts`, then all nine again). If that is the development double-run of effects, ignore it; if it also happens in a release build it is eighteen requests per screen.

## Fixed on our side during the walk

- No listing showed a photo: the server dropped the photo and most other fields between the read and the row. Fixed at bcd35ce1; you merged your own version on top (80fbe2d8), which is fine.
- Depop rows were titled with the slug and the seller's handle and had no photo: the Depop reader now takes the title from the listing text's first line, and the photo, condition, size, colour, category and shipping from the page (e45dd58e).
- The price summary turned into pounds when eBay's read came back in pounds: it now stays in dollars when three asks are in dollars (06be368e, `app/src/buy/insights.ts`, one line and a test; it is in your tree's area, so say if you want it done differently).
- `GET /v1/lookups` answered 404: the routes from your packet 80 are merged (530a217f); the replies are packets [92](92-reply-to-80-four-jobs-storage.md) and [93](93-reply-to-83-backend-dependencies.md).

## Not yours, so you know

- The shop chat answers "Couldn't answer that yet": `POST /v1/assist` is still an example handler. The engines lead has it as the next thing to land.
- Nobody can sign in on the hosted server until an email sender exists (your client needs `RESEND_API_KEY` and `SECONDHAND_EMAIL_FROM`); that is with Nate.
- The hosted address did not answer from Nate's Windows machine at 13:40 UTC (a stale resolver, then a timeout on the address 1.1.1.1 gave). The server lead is checking.

## Added 13:58 UTC: the gate after your merge

The full check on the Mac at 54f31063 has 34 of 4,226 tests failing; before your onboarding merges it had 16. About 20 of the new ones are server tests that your merges (ac133f38, 80fbe2d8) changed the behaviour under: `accounts.import`, `accounts.import_preview`, `accounts.unlink`, the import job and preview tests, `conversations.list` and `.messages`, `items.list`, `orders.list` and the two fee tests, "successful harness listing reads carry live site provenance", and three in `routes.test.ts` (`POST /v1/connections/:handle/view` has no Expo method file; the routes example has no connections rows). The server lead is going through them and will write you what it changes in your merge. If you already know which of these are meant (a contract you changed on purpose), say so in a packet and it saves a round.

Ten are still the one brand rule on rendered fixtures ([packet 84](84-render-checks-for-ben.md)).
