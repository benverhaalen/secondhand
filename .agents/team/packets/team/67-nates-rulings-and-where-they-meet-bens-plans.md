# 67: Nate's rulings on the sites, and where they meet Ben's plans

Updated: November 15, 2026, about 11:45 UTC. Owner: Nate. For: Ben. Agent: Claude Code, Nate's build orchestrator. Base: `main`. Status: the rulings are in the spec and the adapters; the points under "Where they meet your plans" are open and need Ben and Nate to agree, none is changed on Ben's side.

## What Nate ruled today

Each is quoted in [words.md](../../../../product/words.md) under 2026-11-15 and written into [protocol and adapters §8](../../../../spec/engines/protocol-and-adapters.md#8-protections).

| Ruling | Why | What is built |
|---|---|---|
| On Poshmark, share, like and repost are never done by the system. The app suggests one with its reason and opens the listing in an in-app browser; the person taps | Poshmark's Community Guidelines name automated liking, sharing and reposting; its Seller Policy prohibits excessive removal and reposting ([run note](../../../../research/cross-cutting/nate/runs/ad-poshmark.md)) | the Poshmark adapter answers all three with `no_route` and `handoff {url}`, tested. Not built: the suggestion from the marketing engine, the route that carries it, and the in-app browser on a screen. That last one is yours |
| Mercari is read knowingly and under the person's approval: their own linked account, and a search or listing they asked for. Nothing sweeps it on a timer or for people who did not ask | Mercari's prohibited-conduct page: "use any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us to access the Service or to extract data" ([run note](../../../../research/cross-cutting/nate/runs/ad-mercari.md)) | the Mercari adapter's public reads are proved on a real cloud browser, at 5 to 6 seconds a read |
| A broad search across every marketplace leans on sites that already show those marketplaces' listings, and goes to Mercari itself only lightly | same | nothing yet: which sites, what each shows and what each one's terms allow is being checked first (`research/watch/nate/aggregators-for-broad-search.md` when it lands) |
| eBay's official API access is pending approval. Until then eBay reads run on a page harness; the API adapter stays built and takes over when the keys exist | no keyset exists | the API adapter is on main, proved on fixtures only (25 tests). The page lane is stopped before anything was built or read: eBay's robots.txt (version v30.2_COM_August_2026, read 2026-11-15) disallows `/sch/` for every agent, which is search and sold search, and its User Agreement (effective June 28, 2026) bars automated access without eBay's permission and names LLM-driven bots. Nate was shown both and ruled "read ebay pages anyway", so the lane is being built: public pages, no sign-in, a polite pace, a bot check never solved or passed. It bears on `product/qa.md` and `product/live-buy-demo.md`, which answer the scraping objection with "eBay through its official API" |

Also decided on Nate's side, by the engines lead: the valuation backtest uses released sold datasets, not sold pages read in bulk. Its accuracy number will name its dataset, the dates of the sales and the families covered, and may not be called accuracy on today's market ([valuation §9](../../../../spec/engines/valuation.md)).

## Where they meet your plans

Found by a reader over your packets ([the full list of your asks, by lead](../../../../spec/plans/ben-asks.md)).

| Your page | It says | The ruling it meets | Needs |
|---|---|---|---|
| `product/features-proof.md` #14, #20 | Mercari's sold listings are read from the public page; one search across five marketplaces with public readers for seven sites | Mercari only under the person's approval; broad search through other sites | the wording of both claims, once the aggregator check is back |
| `product/live-buy-demo.md`, [watch/62](../watch/62-live-buy-beat-for-the-pitch.md), [watch/65](../watch/65-brewers-alert-and-why-poshmark.md) | the live beat reads Poshmark `/search` every 10 seconds; your own notes record that its robots.txt disallows `/search` and its terms bar automated collection | Nate: "I dont want to violate tos or introduce problems to the users" | Nate and Ben to choose the beat before tonight's timed posts: the price drop on one listing the demo account owns reads no search page at all |
| [watch/65](../watch/65-brewers-alert-and-why-poshmark.md), [list/61](../list/61-ebay-item-specifics.md) | eBay's Browse API as the watch source; an application token for the aspects load | eBay is on the page harness until the API is approved | nothing to change yet: both become true the day the keys exist |
| `product/features-proof.md` #3 against `jobs/studio/check.py` | redraws rejected beyond 20% off the tape; the code and [studio/55](../studio/55-slides-backend-for-nate.md) say 8% | not a ruling, a mismatch | one number |
| [data/66](../data/66-roi-depop-partner-api-and-event-effects.md) against `app/src/edge/sold/OPERATING.md` | a 23-minute live cadence breaks even; the page says 15 | not a ruling, a mismatch | whether the cadence changes |

## One correction from Nate, on dimensions

Your studio thread reads your line "can only ai beautify if you have dimensions" as "no AI redraw without a tape reading" ([studio/55](../studio/55-slides-backend-for-nate.md), `jobs/studio/check.py`). Nate ([words](../../../../product/words.md#2026-11-15-nate-dimensions-come-from-the-published-ones-first-not-from-a-required-tape)): "So bens request wasn't to require that we rely on tape measurement, it was misinterpreted so please don't change that. Its only sensible to first rely on the published dimensions, if it was reliably identified, now too tables can be similar with a slight variation, but our system is built accurate enough to assess what certainty it is in each and intelligent generate ui inputs to clarify". So on the backend a render needs dimensions, and they come from the published ones first when the item is reliably identified; where close variants differ, capture weighs each and asks the one question that settles it; a tape reading is one answer, not a requirement. Nothing in your studio code is changed from Nate's side. If the tape rule in `check.py` is what you meant, say so to Nate; if it is not, the check should take the dimension and its source and confidence from the capture record rather than require a tape.

## What is true on Nate's side now, for your talk track

- Public reads proved on real pages: Depop (search in 1.8 s), Poshmark (about 2.5 s), Mercari (5 to 6 s). No signed-in verb is proved on a real account; no real post, offer answer or delist has been made.
- The search route answered from a stub until today; it is being rebuilt to answer at once and stream each site as it lands. That changes the search response to a job shape; a packet with the old and new responses comes from the integration lead when it merges.
- The benchmark's runner and scorer are merged; no run has happened. Its item set is a proposal of 20 named products in `spec/items/manifest.json` (`market_items`) for you and Nate to change before the first run.
- A guard fault was found and is being fixed: the claim check passes "not wool, real cashmere" against the fact "wool". Do not claim the claim check catches negations until the fix is on the board.
