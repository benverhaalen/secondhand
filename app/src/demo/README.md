# app/src/demo: the world every screen renders

One believable set of rows, so every page shows the same person's things. Read rows from a world and numbers from the derived views; a page never types a number, a date or a name of its own. `import { world, headline, feed } from '@/demo'`; images come from `@/demo/photos` (`photo(key)`, `logo(site)`), kept apart so the data loads in node tests.

Names and states are the canon's ([spec/product.md](../../../spec/product.md) §3 to §5, [spec/examples](../../../spec/examples/)). One difference: money is an integer of cents (`price_cents: 8500`), as in `sell/grid.ts` and `engines/valuation/keep.ts`, not the API's `{amount_cents, currency}`; the currency is the user's, USD everywhere. What a person keeps is computed from the money fee table (`keep.ts`), never typed in. Every time is relative to a fixed `NOW` (Sunday 2026-11-15, noon in Chicago), so renders are stable.

| Export | What it holds |
|---|---|
| `world(name)`, `WORLDS`, `WORLD_NAMES`, default export | A whole world. `new`: signed in a minute ago, nothing linked or listed. `clearing` (default, the person we build for): 11 things over five weeks, 3 sites linked, 1 signed out, 1 never linked, 2 sales since last look, an offer, a pickup, a scam, labels. `flipper`: 64 things on 5 sites, 6 labels, 3 offers, 40 first posts after a folder drop. `buyer`: 3 wants, matches, an offer waiting, a site still linking. `edge` and `one`: for the break pass |
| `World` | `user` (onboarding steps, last open, notification prefs), `connections`, `items` (with `photos`, `attributes`, `valuation`, `limits`, `listings` and each listing's `market_standing`), `offers`, `orders`, `appointments`, `conversations`, `messages`, `decisions` (Today cards, each option says what it `does`), `notices`, `events` (the auto log, with undo), `rules`, `limits`, `goal`, `style`, `wants`, `matches`, `products`, `searches`, `retail` |
| `headline(w)` | The top of Today: money kept since the last open (after fees), the next setup step, or `null`. Never $0 |
| `feed(w)`, `groups(w)` | Today's open cards by tier, deadline, money and age; grouped into batches and queues, except anything due within a day |
| `pill(w, item)`, `sellItem(w, item)`, `shelves(w)` | The Sell pill, the `SellItem` for `sell/grid.ts`, and the shelves in order (Needs you, In progress, Live, Sold, Unsold, Kept) |
| `connectionState(c)` | `connected`, `loading`, `error` (with `c.error` and a relink card) or `not_connected` |
| `setupSteps(w)`, `SETUP` | The seven first-launch steps with `done` |
| `unread(w)`, `thread(w, id)`, `itemById(w, id)`, `handled(w)` | The chat icon's count, one thread in order, an item, and the automatic actions since the last open |
| `insights(w)`, `payouts(w)`, `records(w)` | You: sold, earned, fees, kept, on its way, could earn, worth of kept things, by site, goal progress; money landed and due; the year's sales rows |
| `PRODUCTS`, `product(id)`, `RETAIL`, `SEARCH_DUNKS`, `SEARCH_SLOW`, `SEARCH_EMPTY` | The buy side's market: product pages with price per site and history, official offers, a search with sites still answering, one with one site in, one with nothing found |
| `TITLES`, `AMOUNTS`, `NAMES` | Break content: titles at and past 80 characters, an unbroken one; amounts from $0 to $999,999.99; the longest buyer name |
| `NOW`, `usd`, `usdExact`, `range`, `countdown`, `when`, `day`, `clock`, `ago`, `inHours`, `inDays`, `inMinutes` | Formatters: `$85`, `$77.35`, `3h 40m`, `tomorrow at 6 pm`, `Yesterday`, `5m ago` |
| `youKeep(site, cents, local?)`, `SITE_LABEL` | What a sale keeps after the site's fee; a site's name for `accessibilityLabel` only (show the logo) |
| `photo(key)`, `logo(site)` (in `photos.ts`) | Image sources from `app/assets/demo/` |

Photos are copies inside the app (Metro does not watch the repo's `assets/`): the eight AI stand-ins from `assets/demo-items/`, Ben's three real items downscaled to 640 px, and the five logos from `assets/platforms/square/`. A stand-in is never shown as a real listing.

`node --test src/demo/demo.test.ts` checks whole cents, that every row points at something real, the words (curly apostrophes, no site names, no dashes or emoji), the headline, the feed order and the break content.
