# 21 — Pricing, cross-market search and watch: what Ben's side found and built

Updated: November 14, 2026, 23:30 UTC. Owner: Ben. Agent: Claude Code, project thread "Plan the build for pricing, search and watch". Branch: `main`. Status: research and plan pushed; one decision made; one prototype in the repo; live tests wait on keys.

Ben asked for this packet at 23:03 UTC: "ensure to send a packet to nates agents about all this all this is super big" ([words](../../../../product/words.md#2026-11-14-our-own-monitor-and-a-packet-for-nate)). It is for Nate and Nate's agents. Everything is an *agent proposal* unless it links a decision. Read the linked note before acting on a line; this page is a map, not the evidence.

## Read first

| What | Where | State |
|---|---|---|
| The build plan: one engine, three endpoints, data model, sources, approval points, build order | [research/price/ben/build-plan.md](../../../../research/price/ben/build-plan.md) | proposal |
| Where sold and active listings come from, per site | [comps-sources-live.md](../../../../research/price/ben/comps-sources-live.md) | read from vendor pages, not run |
| Search fan-out, dedupe, deal score, the watch loop | [fanout-and-watch-loop.md](../../../../research/watch/ben/fanout-and-watch-loop.md) | read from code and docs, not run |
| One appraisal run, its 7 human checkpoints, 16 components, backtest | [appraisal-run.md](../../../../research/appraise/ben/appraisal-run.md) | proposal |
| Exa tested live (466 calls on Ben's Mac) | [exa-empirical.md](../../../../research/watch/ben/exa-empirical.md) | **observed** |
| Better monitors than Exa's | [monitor-alternatives.md](../../../../research/watch/ben/monitor-alternatives.md) | vendor pages, not run |
| OpenRouter and Treg in place of ten separate keys | [openrouter-and-treg.md](../../../../research/price/ben/openrouter-and-treg.md) | vendor pages, not run |
| Our own page monitor, with code and tests | [own-page-monitor.md](../../../../research/watch/ben/own-page-monitor.md), [page-monitor/](../../../../research/watch/ben/page-monitor/) | prototype, tests pass on made-up pages |

## Decided by Ben

- **Watch alerts run on Firecrawl, the eBay API and a Facebook search API**, with Exa for the rest of the web and our scrapers as fallback ([decisions.md](../../../../product/decisions.md#2026-11-14-watch-alerts-run-on-firecrawl-the-ebay-api-and-a-facebook-search-api), card at 21:27). Your [spec/features/watch.md](../../../../spec/features/watch.md) already reflects this.

## Facts that change plans

| Fact | Mark | Touches |
|---|---|---|
| Exa returns no Facebook Marketplace pages, none of the newest 60 eBay or 48 Poshmark listings, and nothing on Poshmark under 18 days old. Its monitors are hourly at best and the price limit is only words in the query | observed | watch, buy |
| Exa is still good for the long tail (it found a real Vinted match), for reading a pasted link's price (8 of 8 right), and for deep research. Its sold flag was wrong on 2 of 8; use the page's JSON-LD for sold state | observed | watch, appraise |
| eBay's logged-out sold search now needs a login, and SerpApi dropped its sold filter on 2026-09-28. eBay sold prices come from paid scrapers (an Apify actor, SoldComps, Underpriced), run together | asserted by vendors | price |
| Poshmark, Mercari and Grailed sold prices are reachable; Depop's are not, so Depop is priced from Poshmark and Grailed with a wider range | asserted | price |
| Even with the exact item identified, other sales of it miss by about 28% (FlipTip's published test of 99 sales). Ranges only; max pay reads the 25th percentile | observed, vendor-published | price, appraise |
| Depop, Mercari and Poshmark search need a real browser session; eBay, Facebook, OfferUp and Grailed answer plain HTTP | observed in code | buy, watch |
| The Decisions model is on OpenRouter (`openai/gpt-6-luna-decisions`, 0.18 s typical), with 200 questions per request where OpenAI allows 400, and images as base64 | observed on its page | identify, every typed judgement |
| Treg is one key for 4,100+ tool endpoints at the provider's price. It lists Google Lens ($0.003), eBay search and detail, Firecrawl scrape, Exa search and page monitors. It does not list sold search, Facebook Marketplace or the clothing sites | observed in part of its catalog | connect, data, every outside call |
| GitHub Actions is dead on this repo: every job fails in 2 seconds with no runner, which usually means billing. The stored OpenRouter secret can't be used until that is fixed, and no secret can be read back out | observed | anything that planned to run in CI |

## One conflict for Ben and Nate to settle

Your specs treat eBay's API licence as a limit: [watch.md](../../../../spec/features/watch.md) adds `display_group` so eBay matches sit apart, and [price.md](../../../../spec/features/price.md) recommends training on other sites and showing eBay sales on a separate shelf. Ben said at 21:08: "this is a product demo, getting something that works for a hackathon is different from writing a production app" ([words](../../../../product/words.md#2026-11-14-demo-not-production)), and the build plan now uses eBay data everywhere for the demo. The licence text itself is quoted in [comps-sources-live.md](../../../../research/price/ben/comps-sources-live.md#ebay). Both readings can hold if the split is "demo mixes, production separates", but that is yours and Ben's to say. Until then, keeping `display_group` in the schema costs nothing and lets either answer work.

## Shared interfaces this touches

- **`comp`:** the plan adds `price_basis` (`sold`, `sold_at_list`, `ask`, `model`), `best_offer_accepted`, `phash[]`, `first_seen_at`, `last_checked_at` and a `price_history` child. Your spec has "price type" and a rights note; these should be one set of names. Yours win where they exist; say which are missing.
- **`valuation`:** adds `level` (1 exact item has a live market, 2 adjusted similar sales, 3 a research guess) and, for a buyer, `max_pay` with its basis.
- **`match` and the watch run:** the monitor prototype emits `listing.new`, `price.drop`, `listing.gone`, `monitor.behind` and `monitor.recovered`. Your spec's events are `watch.ran`, `match.found`, `match.alerted`. The monitor's events are a layer below yours (what changed on a page, before matching), so no rename is needed, but `monitor.behind` is what should set `behind:[site]` on `GET /v1/wants`.
- **Outside calls:** if the team takes OpenRouter and Treg, model and tool names in logs and config change (`openai/gpt-6-luna-decisions`, `serper.google.serp.lens`, and so on).

## The prototype

[research/watch/ben/page-monitor/monitor.mjs](../../../../research/watch/ben/page-monitor/monitor.mjs) is a listing-aware page monitor: schedule, fetch (passed in), extract, diff, signed webhook with retries. Run its tests with `node --test research/watch/ben/page-monitor/monitor.test.mjs`. It is a research prototype under Ben's folder, so `check.mjs` does not run it and it claims no file in `spec/plans/`. If your watch plan wants it, take it into a task; it has no dependencies and one writer so far.

## Waiting on Ben

- Keys on his Mac: `OPENROUTER_API_KEY` and a Treg token, then Apify. With those, the smoke tests run: a Decisions call with an image, Google Lens on five items, one sold-comps pull, and the monitor on a real newest-first page.
- Fixing Actions billing, if CI should be used at all.
- Three open choices in the build plan: which sold-data services, a second vision model for labels, and the three demo categories.

## Next action for Nate's agents

Check the three interface points above against `spec/product.md` and say where names differ. Nothing here should be built on until Ben and Nate settle the eBay line.
