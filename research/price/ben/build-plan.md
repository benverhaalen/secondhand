# How do we actually build pricing, cross-market search and watch alerts this weekend?
Researched 2026-11-14 by Ben (Claude Code agent, thread "Plan the build for pricing, search and watch"). Feature: price (also appraise and watch).

This is the implementation plan. It rests on four notes written in the same pass, each built with looped seeded research (it-already-exists, `research-improvement.md` § "Seeded, adaptive investigation") and RDD transfer contracts:

| Note | Question it settles |
|---|---|
| [comps-sources-live.md](comps-sources-live.md) | Where sold comps and active listings come from, platform by platform |
| [fanout-and-watch-loop.md](../../watch/ben/fanout-and-watch-loop.md) | How live search and the watch loop run, site by site |
| [appraisal-run.md](../../appraise/ben/appraisal-run.md) | One appraisal run step by step, its checkpoints, components and backtest |
| [exa-empirical.md](../../watch/ben/exa-empirical.md) | What Exa really covers, how fresh it is, and what its price alert does, run live on Ben's Mac |
| [monitor-alternatives.md](../../watch/ben/monitor-alternatives.md) | Whether another monitor beats Exa's for fresh listings |

Earlier notes it builds on: [valuation-engine.md](valuation-engine.md), [sold-price-data.md](sold-price-data.md), [pricing-in-context.md](pricing-in-context.md), [one-search-box.md](../../watch/ben/one-search-box.md), [exa-alerts.md](../../watch/ben/exa-alerts.md), [garage-sale.md](../../appraise/ben/garage-sale.md).

Ben's principles for this pass ([words](../../../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui)): judges love human in the loop; dynamic UI built from a large set of fixed components; API cost doesn't matter; a tool Ben named is the default unless a better one turns up.

Everything below is *agent proposal* unless it links to a decision. Facts carry the mark from their source note.

## What changed since the earlier research

1. **eBay sold data is harder to get than we thought.** eBay's logged-out sold search started redirecting to sign-in in July and August 2026 (asserted by three vendors with dates). SerpApi deprecated its sold filter on 2026-09-28 (observed). The working routes are third-party Apify actors and sold-comps APIs, and a signed-in browser agent as the last resort. Details in [comps-sources-live.md § eBay](comps-sources-live.md#ebay).
2. **eBay's API licence does not constrain the demo.** Its text bars using API content "to suggest or model prices for items listed on eBay Sites" and mixing it with other sites' content in one display (observed). Ben's rule is that this is a demo and we build with whatever works ([demo, not production](../../../product/words.md#2026-11-14-demo-not-production)), so the demo uses eBay data everywhere: Browse API rows feed the price engine as asking prices and sit in the same grid as every other site. The clauses are recorded in [comps-sources-live.md](comps-sources-live.md#ebay) for whoever takes this to production. They don't matter much in practice anyway, because the Browse API has no sold prices; those come from the routes below.
3. **Poshmark, Mercari and Grailed sold prices are reachable; Depop's are not.** Depop is priced by translating Poshmark and Grailed sold prices with a wider range, and says so.
4. **Even a perfect identity misses by about 28%.** In FlipTip's published blind test of 99 eBay sales, the median of other sales of the exact same item was off by $28 on $100 (observed, vendor-published). Ranges, never a point price; max pay reads the 25th percentile.
5. **Depop, Mercari and Poshmark need a real browser session to search.** Only eBay (official), Facebook (internal GraphQL), OfferUp (anonymous GraphQL) and Grailed (Algolia) answer plain HTTP calls (observed in code). The search box needs hard per-site deadlines and partial results.
6. **Search rows on Depop, Poshmark and OfferUp carry no creation date.** "New since last check" has to be a set of seen listing IDs per watch, not a timestamp.
7. **Exa is stale on the big marketplaces and blind to Facebook**, measured live. It can't be the watch engine for them; see [§ Exa's role](#exas-role-from-the-live-test).

## One engine, three surfaces

```
sources (pre-fetched seed + live)      Databricks                         surfaces
──────────────────────────────────     ──────────────────────────────     ─────────────────────────
Apify sold actors (eBay, Posh,     ┐   bronze  raw rows + images          Sell draft: range per site
  Mercari, Grailed)                │     │                                Buy search: deal badge
eBay Browse (active, by image)     │     ▼                                Camera "What's it worth"
FB GraphQL, OfferUp, Grailed HTTP  ├─► silver  Comp: one schema   ──►  /value  ──►  Watch alerts
Depop/Posh/Mercari via browser     │     │     (sold|active|ask)       /search
Discogs per-grade                  │     ▼                              /watch
Google Lens via SerpApi (asking)   │   gold    identity clusters,
Exa (see live test)                │           driver lexicon, factors,
our own sales                      ┘           category bands
                                     MLflow trace per step ──► "why?" timeline on every Item
```

Price, appraise and search are one engine reading one index of identity-resolved Comps ([one-search-box.md](../../watch/ben/one-search-box.md)). The three endpoints:

| Endpoint | Input | Output | Used by |
|---|---|---|---|
| `POST /value` | photos, text or a listing URL; answers so far; mode `sell`, `appraise` or `search_result` | identity candidates, range per site (p25, p50, p75, net, days), comps with adjustments, drivers, next question, level 1/2/3, abstained | Sell draft, camera, every search card |
| `POST /search` | text, photo or URL; filters | `search_id` at once with index hits, then each site's batch as it lands, with a status per site | Buy |
| `POST /watch` | a Want: text, fit, cap, sites | watch id; matches arrive as alerts or as Today Decisions | Buy > Watching |

The `/value` response shape stays as in [valuation-engine.md § API shape](valuation-engine.md#api-shape), with three additions: `level` (1, 2 or 3), `price_basis` per comp (`sold`, `sold_at_list`, `ask`, `model`), and `max_pay` with its `basis` in appraise mode ([appraisal-run.md § 8](../../appraise/ben/appraisal-run.md#8-max-pay-code)).

## Data model

Uses the reconciled primitive list in [primitives.md](../../../product/primitives.md#one-list-reconciled). Lakebase holds app state; Delta holds Comps and history ([decision](../../../product/decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback)).

| Table | Key fields | Notes |
|---|---|---|
| `comp` | `site, site_id, status (sold, active, ended), price, shipping, currency, total_usd, sold_at, created_at, first_seen_at, last_checked_at, price_basis, best_offer_accepted, title, photos[], phash[], embedding, identity_id, condition, drivers{}, source (actor or route), fetched_at` | One row per listing, updated in place; `price_history` as a child table |
| `identity` | `id, category, brand, line, model, variant, catalogue_ids{}` | Clusters; catalogue IDs where they exist (Discogs release, UPC, style code) |
| `valuation` | `subject (item_id or comp_id), by_site[], comps[], level, abstained, max_pay?, created_at, trace_id` | Recomputed on demand; a Decision keeps the one it showed |
| `want` | `text, parsed{identity, size, fit, cap}, sites[], schedule, quiet_hours, seen{(site, site_id)}` | A Watch is a Want with a schedule |
| `label` | `question, inputs, probabilities, human_answer, at` | Every human checkpoint answer, the learning loop |

Comp dedupe across sites follows [fanout-and-watch-loop.md § Dedupe](../../watch/ben/fanout-and-watch-loop.md#dedupe-of-cross-listed-items): compare only within one identity and price band, pHash first (0 to 5 same, over 12 different), an image embedding for the grey zone, and ignore any image seen under 3 or more sellers (a stock photo).

## Sources, in the order we build them

From [comps-sources-live.md § Recommended demo source stack](comps-sources-live.md#recommended-demo-source-stack-agent-proposal). Pre-fetch a seed set for the demo categories before the demo; hit live routes only for the query on stage.

| # | What | Route | Fallback | Label |
|---|---|---|---|---|
| 1 | eBay active, and photo search | Browse API `search`, `search_by_image` | SerpApi eBay (active) | ask; mixed into the one grid |
| 2 | eBay sold | Apify `caffein.dev/ebay-sold-listings`, SoldComps API and Underpriced, all three at once, merged by listing ID | a signed-in browser agent on a spare account | sold; Best Offer rows flagged and discounted |
| 3 | Poshmark sold | Apify `kulqiz/poshmark-sold-comps` | `solidcode/poshmark-scraper` | sold at list price |
| 4 | Grailed sold | Apify Grailed actor, or Grailed's Algolia index directly | `bovi/grailed-listings` | sold |
| 5 | Mercari sold | Apify `devilscrapes/mercari-sold-listings`, pre-fetched only (45% run success) | multi-site actor | sold, date approximate |
| 6 | Records | Discogs price suggestions, per grade | none | level 1 |
| 7 | Active fan-out | FB GraphQL (secondhand-mcp's path), OfferUp GraphQL, Grailed Algolia, Depop/Poshmark/Mercari through a warm browser | Apify actor per site | ask |
| 8 | Depop prices | Translate from Poshmark and Grailed sold with a category ratio | none | model, wider range |

Smoke-test #2 tonight: it is the one most likely to have broken under the login wall. Running three sold routes at once is the answer to that risk: any one of them working is enough, and where they overlap we can check them against each other.

## The valuation run

The full run, its JSON at each step, and its latency budget are in [appraisal-run.md](../../appraise/ben/appraisal-run.md#step-by-step). In short:

| Step | Who does it | Budget |
|---|---|---|
| 1 Glance: category, photo usable, label visible, several items | One OpenAI Decisions call (Ben's tool) plus a cached category band on the phone | 1.5 s; works offline from the band |
| 2 Identify | Three calls in parallel: a vision model reading labels, Google Lens via SerpApi, eBay `search_by_image` | first candidates by 4 s, settled by 8 s |
| 3 Confirm identity | **The person** | always shown |
| 4 Comps | Databricks Vector Search, hybrid; junk filter as batched Decisions predicates | 1.5 s |
| 5 Adjust | Plain code, each adjustment written out | under 100 ms |
| 6 Range per site | Weighted quantiles, net of fees; 70% coverage; abstain below 6 sold in 12 months and 2 in 90 days (Manheim MMR's rule) | under 100 ms |
| 7 Next question | Code picks the unknown that could flip the decision; Decisions pre-fills a likely answer | 1 s |
| 8 Max pay | Code, from the best site's p25 net, times P(identity), P(condition), P(authentic) | instant |
| 9 Verdict and haggle | Code; the haggle pad reruns 8 and 9 offline | instant |
| 10 Bought it | **The person**; creates an Item already priced | |
| 11 Deep | Background agent with Exa and a browser for long-tail items; writes comps back | minutes |

Selling uses the same run from step 2, with the item's guided shots as input and no max pay.

**Models.** OpenAI Decisions for every typed judgement (it is GA and takes base64 or public URLs, observed). Its model reads text poorly (59.8% on Roboflow's OCR eval, observed), so a separate vision model reads labels. [appraisal-run.md](../../appraise/ben/appraisal-run.md) proposes Gemini 4 Carbon for that (87.2% on the same eval); it is the one tool here Ben didn't name, so it's listed under Decisions for Ben.

**Hidden drivers default to "unknown", never "absent".** Vision models are much worse at saying an attribute isn't visible than at seeing it when it is (observed, older-model paper). Unknown drivers are exactly what the question card asks about.

## Cross-market search

From [fanout-and-watch-loop.md](../../watch/ben/fanout-and-watch-loop.md#search-request-fan-out-with-partial-results):

1. `POST /search` returns at once with index hits.
2. One task per site, with a hard deadline: 2.5 s for the plain-HTTP sites, 7 s for the browser sites. A late site keeps running and feeds the index and New matches.
3. Each batch streams to the phone; cards are merged, deduped and scored in place without jumping. Each site shows a status chip: done, slow, or not reached.
4. Score: `deal = (p50 − total) / (p75 − p25)` from `/value`, times identity match, seller trust and freshness. Thin comps widen the range, so they can't produce a loud deal.
5. Every card says when it was checked. Tapping through re-fetches that listing first.
6. Price caps are always applied in our code: Depop and Poshmark ignore URL price filters, and eBay drops a price filter sent without `priceCurrency` (observed in code).

A pasted link runs `getItem` for eBay or the site's detail fetch, then `/value` on it. A photo runs step 2 of the valuation run, then searches by the confirmed identity.

## Watch alerts

From [fanout-and-watch-loop.md § The watch loop](../../watch/ben/fanout-and-watch-loop.md#the-watch-loop), with Exa's part set by the live test below.

1. **A want becomes a structured query.** Text plus a few tap questions (size, fit by measurement, cap, sites) become `want.parsed`. Ambiguity is a one-tap question, not a guess.
2. **Check what someone watches every 5 to 10 minutes, with bought services** (decided by Ben, [decisions.md](../../../product/decisions.md#2026-11-14-watch-alerts-run-on-firecrawl-the-ebay-api-and-a-facebook-search-api); [monitor-alternatives.md](../../watch/ben/monitor-alternatives.md), untested): a Firecrawl monitor on each site's newest-first search page for Poshmark, Mercari, Depop, Grailed and OfferUp; the eBay Browse API for eBay; the ScrapeCreators API for Facebook. Our own adapters and Apify actors are the fallback. Identical wants share one query. This sits well inside the decided "within the hour" ([decision](../../../product/decisions.md#2026-11-14-the-buy-tab-mirrors-sell-with-shelves)).
3. **New means unseen.** A listing is new if `(site, site_id)` isn't in the watch's seen set. The first run fills the set silently and shows current matches, not alerts.
4. **Price drops** come from a known ID reappearing cheaper or from rechecking watched items. With no cap, alert when the price falls at least 10% below the lowest seen, for items of $10 or more (Poshmark's own rule, observed).
5. **The threshold is our code:** `total_usd <= cap AND match >= 0.8 AND fits AND live`. Exa's monitors have no price threshold of their own (observed in [exa-alerts.md](../../watch/ben/exa-alerts.md); see the live test for its newer feature).
6. **Before any alert, re-fetch the listing**, so we never alert on something already sold.
7. **One alert per item, not per site.** A cross-listed jacket alerts once; it re-alerts only for a lower total.
8. **Middling matches ask.** A match between 0.6 and 0.8 doesn't notify. It becomes a "Same item?" Decision in Today with both photos; the answer trains the watch.

### Exa's role, from the live test

Run live on Ben's Mac, 466 billed calls ([exa-empirical.md](../../watch/ben/exa-empirical.md)). All figures observed there unless marked.

| Question | Result |
|---|---|
| Does Exa index marketplace listing pages? | Yes for Poshmark (85 to 90% of results are listing pages with prices), OfferUp, Grailed, Mercari and Depop (Depop with no price or sold state). **No Facebook Marketplace pages at all.** eBay item pages come only from cache; a live fetch of eBay times out at about 10 s |
| Is it fresh? | No. 0 of the newest 60 eBay and 48 Poshmark listings came back. The newest Poshmark listing it returned was 18 days old. Exact-title searches for 15 eBay listings posted in the last 2 hours found none |
| Is it live? | Many results are already sold: about 60% on OfferUp, 21 to 28% on Poshmark, about 22% of eBay item pages |
| What is the feature in Ben's link? | Monitors v2: `POST /monitors` with a text query, optional domains, an output schema and a webhook. Minimum cadence 1 hour (30 minutes is rejected). **The price limit is words in the query, judged by Exa's model; there is no numeric price field** |
| Did the alert work? | The open-web monitor for "Arc'teryx Beta LT jacket men's medium listed for sale under $250" found one Vinted listing at €130. The same monitor limited to our seven marketplaces found nothing |
| Sold comps through Exa? | Only by chance: 18 of 180 eBay item pages carried "sold on" with a price. eBay sold-search pages hit the login wall; 130point returned no data pages |
| Extraction from a listing URL | Every price and currency returned was right (8 of 8); the sold flag was right 6 of 8; both eBay pages timed out |

So Exa keeps three jobs and loses one:

1. **Not the watch engine for the core sites.** A fresh listing on eBay, Poshmark or Facebook is exactly what Exa doesn't have. The per-site polling loop above is the primary route, and it is what makes "within the hour" true.
2. **The long tail of a watch.** Each Want also creates one open-web Exa monitor (no domain filter, hourly), which catches listings on sites we have no adapter for: Vinted, small vintage shops, forums. Its hits go through the same threshold code and the same re-fetch before alerting.
3. **Deep research** for items the index can't price, and extra sold rows where Exa happens to hold a sold page.
4. **Reading a pasted link** from a site with no adapter, through `/contents` with a schema. Not for eBay.

On stage this is still "Exa alerts" as Ben described it: type a want, get notified. What changes is that the hourly marketplace part is ours and Exa covers everything else.

Two monitors from the test are still running. The Exa account ran out of credits during the test (402), so they fail until it is topped up.

## Human approval points

Every checkpoint maps to the decided tiers ([decision](../../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)) and each answer is stored in `label`, which is how approvals train the tiers.

| Where | What the person sees | Tier | Why a human |
|---|---|---|---|
| Identity | Up to 3 candidates with the evidence that separates them, plus "None of these" | Ask, always | Most pricing error is identity error; FlipTip had the right model among its choices only 55% of the time (observed) |
| Next question | One card, pre-filled likely answer, "Can't check" | Ask | Checks a photo can't do: does it turn on, smell, count the pieces |
| Authenticity, high-fake brands | "Pay as if fake: $4. Check the tag stitching to raise it" | Ask | Fake rates of 35% to over 70% for some apparel brands (observed, Entrupy, a biased sample) |
| Remove a comp | The comps strip, each with its adjustment | Ask | The person can see "not the same" faster than a model |
| Bought it | Amount prefilled | Never alone | Money and ownership |
| List price, sell side | Range per site and the slider | Ask on first post; a price below the floor always asks ([decision](../../../product/decisions.md#2026-11-14-a-price-below-your-floor-always-asks)) | |
| Same item? on a watch | Both photos | Ask | Middling match confidence |
| Buy through a link | Re-fetched listing | the person leaves to the site | We never pay for them |

## Dynamic UI from a fixed catalog

Ben wants "dynamic and intelligent ui ... where you have a huge range of set components". The run never writes free UI: Google's free-form generative UI can take "a minute or more" (observed). Instead, the server picks from a fixed catalog of our components and fills them, as A2UI v0.9 and AI SDK typed tool parts do (observed). Code decides which components must appear (no price without the comps strip, no verdict without max pay); the model picks only the optional ones, through a Decisions choice question, so the pick is thresholded and logged. The 16-component catalog is in [appraisal-run.md § The component catalog](../../appraise/ben/appraisal-run.md#the-component-catalog); search and watch reuse `range_bar`, `channel_strip`, `comps_strip` and `question_card`, and add a site status chip and a "Same item?" card. Copy for each goes through [copy.md](../../../product/copy.md): photos and dates, never "n=41".

## Failure and edge cases

The per-step tables are in [appraisal-run.md § Failure and edge cases](../../appraise/ben/appraisal-run.md#failure-and-edge-cases) and [fanout-and-watch-loop.md § Failure modes](../../watch/ben/fanout-and-watch-loop.md#failure-modes-and-what-the-user-sees). The ones that shape the build:

| Case | What happens |
|---|---|
| A sold actor breaks or returns nothing | Next route in the source table; the index still answers from the seed set, with its date |
| A site blocks or times out in search | Its chip says "not reached"; index rows for that site still show |
| Too few comps | Coarser band with a small-sample mark, level 3 label, and a Deep research offer; never a model-only price |
| Wrong identity | Tapping another candidate re-prices without a new photo |
| Fake or reproduction | Max pay as if fake until the person checks |
| Several items in one photo | One band per item, and a lot price where lot comps exist |
| No signal at a garage sale | Glance and haggle run on cached bands; Check queues and notifies later |
| Best Offer sale on eBay | Accepted price is not published; the row is flagged and discounted |
| Listing sold since we saw it | Re-fetch before showing Buy or sending an alert |
| Duplicate across sites | One card, "on 3 sites, cheapest total on Poshmark" |

## How we know it's right

From [appraisal-run.md § How we know it's right](../../appraise/ben/appraisal-run.md#how-we-know-its-right):

1. **Backtest on held-out sold listings,** with FlipTip's published method so our numbers compare with theirs: first photo only, the tested sale removed from its own comps, Best Offer sales excluded. Report identity accuracy, the share of real sale prices inside our range (target 70%), the typical miss, and the abstain rate.
2. **A labelled set of about 40 of the team's own items** for identity and condition.
3. **Search and watch:** one query per site from the demo host, ten times, for latency and block rate; 50 hand-labelled cross-listed pairs to set the dedupe threshold.

## Build order

Each step leaves a working demo.

| # | Build | Smoke test that proves it |
|---|---|---|
| 1 | Seed fetch: run the sold actors for the demo categories into bronze and silver | Rows with sold price and date per site |
| 2 | `/value` with comps, adjust, range, abstain; Decisions for Glance and junk filter | One known item priced per site with its comps |
| 3 | Identity: label reader, Lens, eBay image search in parallel; identity picker | Five garage photos, time to first candidate |
| 4 | Appraise screen from the component catalog, with haggle and Bought it | Full run on stage in under 10 s |
| 5 | `/search` fan-out with deadlines, dedupe and the deal score | Ten runs per site, latency and block rate |
| 6 | Watch loop with the seen set, price drops and "Same item?" | A planted listing alerts once within 15 minutes |
| 7 | Exa: one open-web monitor per Want, Deep research, pasted links | A monitor run returns a long-tail listing that passes our threshold |
| 8 | Backtest and the number on a slide | Coverage and typical miss on held-out sales |

## Decisions for Ben

1. **Which paid sold-data services to sign up for.** Ben's rule is that paid APIs and several at once are fine ([words](../../../product/words.md#2026-11-14-paid-apis-are-fine)). Recommended: all three eBay sold routes at once (the Apify actor, SoldComps and Underpriced), merged and deduped by listing ID, plus Apify for Poshmark, Mercari and Grailed and SerpApi for Google Lens. That needs Apify, SoldComps, Underpriced, SerpApi, OpenAI and eBay developer keys; only an Exa key exists on Ben's Mac today.
2. **A second vision model for reading labels.** Recommended: add one (Gemini 4 Carbon was the strongest on the OCR eval) beside Decisions, since Decisions' model reads text poorly.
3. **Which three demo categories.** The earlier proposal stands: vintage tees, records or video games, and one local category such as furniture.
4. ~~Exa's role.~~ Decided at 21:27: Firecrawl, the eBay API and a Facebook API run the marketplace watches; Exa covers the rest of the web.

## Limits

No route in this plan was run from this cloud machine: its network blocks every marketplace and Exa. The sold-source and search findings come from vendor pages, actor pages and open-source code, and each "it works" is the vendor's claim. The Exa findings are the only live measurements, and its freshness test covered three queries before the account ran out of credits. Latency figures other than those measured are estimates.
