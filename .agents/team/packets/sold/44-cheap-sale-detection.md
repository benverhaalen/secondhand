# 44: knowing when an item sold, cheaply, and five server-side gaps

Updated: November 15, 2026. Owner: Ben. Agent: Claude Code, project thread "Detect sales cheaply on the server". Branch: `main`. Status: research and a tested prototype pushed; nothing in `spec/` changed. Everything here is an *agent proposal* for Nate's spec.

Evidence: [cheap-sale-detection.md](../../../../research/sold/ben/cheap-sale-detection.md). Prototype: [dom-watch/](../../../../research/sold/ben/dom-watch/watch.mjs), `node --test research/sold/ben/dom-watch/watch.test.mjs` (2 pass, one over `connectOverCDP`).

## Proposed changes to Nate's files

| Where | Today | Proposal | Why |
|---|---|---|---|
| [card 15](../../../../spec/determinations/managing-and-buyers.md#15-when-to-check-again), [sold.md](../../../../spec/features/sold.md) detection table | Poshmark and Mercari: a signed-in sold-page poll every 1 to 2 min | a public closet and listing poll from our server at that tier; the signed-in read only after a trigger | a sold Poshmark listing stays public with `meta-product:availability: oos` (observed); Mercari carries JSON-LD `SoldOut` (observed in Ben's Exa test). No login, no browser minutes, no ban risk to the account |
| [card 12](../../../../spec/determinations/managing-and-buyers.md#12-whether-a-sale-really-happened) | only a paid order read counts | unchanged, with one option: on Poshmark, public `oos` plus a matching sale email could start the delist while the read runs | takes the 1 to 4 min browser read off the critical path; your call |
| sold.md, product.md §6 | Gmail OAuth read-only for sale email | a forwarding filter to an inbound address, as a hint only | your own note: Gmail scopes are restricted and need CASA; your words prefer the harness |
| sold.md, the edge | 2xx in under 1 s | also reject unsigned hooks: `X-EBAY-SIGNATURE` via `getPublicKey`; `X-Depop-Signature` HMAC over `timestamp.body` with a time window | an unverified hook URL is a trigger anyone can fire |
| product.md §6 secrets | the user signs in inside the cloud browser | the app gets a one-time link to a sign-in page we host, never a raw `cdpUrl`, live-view URL, profile id or vendor key | those URLs drive the signed-in session |
| Depop access email | partner access | also ask Depop to configure webhooks for OAuth shops | the docs say webhook configuration takes an API key only, "not yet available through the OAuth 2.0 flow" |

On your "our own harness over official APIs" ([words](../../../../product/words.md#2026-11-14-nate-our-own-harness-over-official-apis-and-opencli)): the note proposes using eBay's and Depop's push only as a trigger, because no harness can be told by the site that a buyer paid, and keeping the harness for every read and action. If you disagree, the public-page poll covers those two sites as well, a few minutes slower.

## Done on Ben's side

- `.agents/checks/secrets.mjs` now fails a key-like `EXPO_PUBLIC_` name, a screen importing `app/src/edge/`, and a key-like name under `app.json` `extra`, so no secret can reach the shipped app. Test in `checks.test.mjs`. Main passes it today.

## Next action

Nate: accept, change or decline each row above in the spec. Ben's agents: when the harness exists, save one public Poshmark and Mercari fixture each (sold, available, not for sale) and point Ben's page monitor at them.
