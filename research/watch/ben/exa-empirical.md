# Can Exa find secondhand listings, fresh, with prices, and alert on them?
Researched 2026-11-14 by Ben (Claude Code agent on Ben's Mac, run live against api.exa.ai). Feature: watch.

Builds on [exa-alerts.md](exa-alerts.md), which assumed Exa could do this but could not test it, and answers the open question in [fanout-and-watch-loop.md](fanout-and-watch-loop.md) ("Where Exa fits"). Script: [exa-tests/run.py](exa-tests/run.py). Raw JSON for every call stays on Ben's Mac in `~/secondhand-exa-raw/` (466 billed calls, about $7.08, observed from `costDollars`).

## Answer

Exa is a good **long-tail and comps** source and a poor **watch** source. *(inferred from the numbers below)*

- It indexes listing pages on Poshmark, Depop, Mercari, Grailed and OfferUp, and returns prices for most of them. It returns **no Facebook Marketplace pages at all**, and on eBay it mostly returns category and product pages, not item pages. *(observed)*
- What it has is **weeks to years old**. None of the 236 eBay and 192 Poshmark listings posted in the hours before the test came back, and the newest Poshmark listing Exa returned was 18 days old. *(observed)*
- Many listings it returns are **already sold**: 59–62% on OfferUp, 21–28% on Poshmark, about 22% of eBay item pages. *(observed, heuristic; see method)*
- **Monitors v2** (the feature in the tweet) is real and works through the API, but the price limit is plain words in the query, judged by Exa's model. There is no numeric price field. The minimum cadence is 1 hour. A monitor limited to the seven marketplaces returned nothing on its first run. *(observed)*
- Live fetching of eBay pages fails: 28 of 30 fetches of new eBay item pages and both eBay pages in the extraction test timed out at about 10 s, and the eBay sold-search pages that loaded were eBay's login or security wall. *(observed)*

So for "tell me within the hour when this drops below $X", our own per-site adapters (eBay Browse API, the GraphQL and browser routes in [fanout-and-watch-loop.md](fanout-and-watch-loop.md)) stay the primary route. *Agent proposal:* use Exa for (1) sold comps for pricing, (2) the long tail outside the seven sites (Vinted, small shops, forums), and (3) reading a pasted link from a site we have no adapter for, except eBay.

## 1. Credentials found (names only)

| Name | Where |
|---|---|
| `EXA_API_KEY` | shell environment *(observed)* |
| OpenAI, eBay client id or secret, SerpApi, Apify, Browser Use, Databricks | none found in the shell env, `~/.zshrc`, `~/.zprofile`, `.env` files in this repo, `~/hackathons*`, `~/madhacks-ideation`, or `~/.local/share/harness` *(observed)* |

No eBay key, so the freshness test read eBay's public newest-first page in a browser instead of the Browse API.

## 2. Ben's research procedures

| Term | File | What it requires *(observed)* |
|---|---|---|
| RDD | `~/.claude/skills/reference-driven-development/SKILL.md` | Recover the goal, audience and scope first; find references and give each a job; transfer the useful mechanism, not the surface; describe a complete journey and observable success before building; verify the real result. |
| IAE | same file, line 8 | "It-already-exists": RDD is called "the umbrella method of it-already-exists". Assume someone has solved the structure; find and adapt it. No separate IAE file was found. |
| Looped seeded research | `~/.local/share/harness/skills/research/references/deep.md`, method in `reference-driven-development/references/research-improvement.md` ("Seeded, adaptive investigation") | Write the decision and a draft answer; pick seeds for a nameable quality cue, including one from an unrelated field; read each seed individually; after each round write a frontier (what changed, marked claims, gaps, a contrary lead, next searches); search against the answer every round; drop the domain's vocabulary every few rounds; stop when a round changes nothing. |

## 3. Monitors v2, tested live

The tweet (2026-11-02) announces "Exa Monitors V2", 7x cheaper at $2 per 1,000 runs *(observed via api.fxtwitter.com)*. The [blog post](https://exa.ai/blog/monitors-v2) (2026-10-29) lists "Products, prices, and stock" as a use, with the example query "ASICS men's woven sneakers: sale or price drop", and says Exa's index holds 1.27B product listings *(observed; the index size is asserted)*. Each run has three stages: retrieve with a time window matched to the cadence, judge (drop seen pages; check relevance, source legitimacy, new information, event timing), compose a summary or JSON *(asserted by the blog)*.

**Endpoint** *(observed in the [docs](https://exa.ai/docs/monitors/quickstart.md) and by calling it)*: `POST https://api.exa.ai/monitors` with `search` (`query`, `numResults` ≤ 100, `includeDomains`, `excludeDomains`, `contents`; nothing else), `trigger` `{"type":"interval","period":"1h"}`, optional `outputSchema`, `metadata`, and a required `webhook` `{url, events}`. `POST /monitors/{id}/trigger` runs it now; `GET /monitors/{id}/runs` lists runs with `output.results`, `output.content` and `output.grounding`.

| Test | Result |
|---|---|
| Create, period `1h` | 201 in 0.7 s; returns `id`, `status: active`, and a one-time `webhookSecret` (not stored) *(observed)* |
| Create, period `30m` | 400: "minimum of 1 hour" *(observed)* |
| Webhook `https://example.com/...` | 400: "cannot point to localhost, .local domains, or private IP addresses" *(observed)* |
| Webhook delivery | not observed. webhook.site was blocked by this machine's permission rules, so the monitors post to `https://exa.ai/secondhand-webhook-sink` (a 404 on Exa's own site) and I read runs through the API. Payload shape and `Exa-Signature` HMAC are from the docs only *(asserted)*. |
| Monitor A: "Arc'teryx Beta LT jacket men's medium listed for sale under $250", open web, 25 results, `outputSchema` {title, price_usd, size, marketplace, url} | First run 23 s: **1 result**, a Vinted France listing, size M, €130 (€137.20 with fees), returned as `price_usd: 140`, confidence "medium" *(observed)*. Scheduled run at 21:02 UTC: 0 new results *(observed)*. |
| Monitor B: same, `includeDomains` = the seven marketplaces | First run 6 s: **0 results** *(observed)*. |
| Scheduling | Created 20:45:55; first scheduled run 21:02:15, next 22:02:07 *(observed)*. The docs say runs may slip up to 30 minutes *(asserted)*. |

**Is the price limit enforced?** Not as a number. There is no price field in the API *(observed)*; "under $250" reaches only the query and the model's relevance judgment *(asserted by the blog)*. The single result was under the limit, which one sample cannot confirm *(inferred)*. Our code must still check `price <= cap` *(inferred)*.

**Why Monitor B found nothing** *(inferred)*: each run searches a time window matched to the cadence, and the freshness test below shows Exa's marketplace pages are weeks old and mostly undated, so an hourly window has nothing in it.

Both monitors are still running: `01m7dwygdf28bhm0sx7tnrfz5h` (open web) and `01m7dwz213rrf46kcc9z7vvq0j` (marketplaces). Request body without secrets: `~/secondhand-exa-raw/monitor-request.json`.

## 4. Coverage: 12 queries × 7 sites × 3 modes

Queries: vintage Nirvana tee, Carhartt Detroit jacket, Levi's 501 big E, Switch OLED, PS5, Charizard card, Air Jordan 1 size 10, Patagonia Synchilla, IKEA Poäng, KitchenAid mixer, Coach bag, and the 1973 Harvest SMAS-11163 pressing of *Dark Side of the Moon*. Each ran with `includeDomains` set to one site, `numResults` 25, in three modes: `auto` with `maxAgeHours: 0` (live fetch), `auto` with cached text, and `keyword` with cached text. 252 calls, all 200 *(observed; run 2 of 2, below)*.

A "listing page" matches the site's item URL (`ebay.com/itm/`, `poshmark.com/listing/`, `depop.com/products/`, `mercari.com/us/item/`, `grailed.com/listings/`, `facebook.com/marketplace/item/`, `offerup.com/item/detail`). "With price" means the returned text contains a dollar amount. "Sold or ended" means the text contains the site's own sold wording: Poshmark "SORRY, THIS ITEM IS SOLD!", Mercari "SOLD OUT", Grailed "This listing sold", eBay "This listing sold on", OfferUp a line reading "SOLD" (I checked the matched phrases for each site, so "Sold by <seller>" does not count).

| site | mode | results | listing pages | with price | sold or ended | has publishedDate | p50 / p90 latency (s) |
|---|---|---|---|---|---|---|---|
| ebay.com | live | 100 | 4 (4%) | 4 | 0 | 16% | 12.0 / 12.4 |
| ebay.com | cached | 261 | 120 (46%) | 120 (100%) | 26 (22%) | 12% | 1.4 / 1.7 |
| ebay.com | keyword | 93 | 56 (60%) | 56 (100%) | 12 (21%) | 5% | 2.0 / 2.7 |
| poshmark.com | live | 226 | 192 (85%) | 192 (100%) | 53 (28%) | 1% | 5.0 / 5.3 |
| poshmark.com | cached | 264 | 238 (90%) | 238 (100%) | 51 (21%) | 1% | 0.3 / 2.2 |
| poshmark.com | keyword | 97 | 85 (88%) | 85 (100%) | 12 (14%) | 2% | 0.2 / 3.0 |
| depop.com | live | 296 | 213 (72%) | 27 (13%) | 0 | 5% | 3.8 / 4.9 |
| depop.com | cached | 295 | 222 (75%) | 40 (18%) | 0 | 3% | 1.8 / 2.5 |
| depop.com | keyword | 60 | 51 (85%) | 14 (27%) | 0 | 0% | 2.2 / 2.8 |
| mercari.com | live | 246 | 147 (60%) | 147 (100%) | 8 (5%) | 1% | 3.4 / 5.3 |
| mercari.com | cached | 300 | 204 (68%) | 147 (72%) | 3 (1%) | 1% | 1.6 / 2.6 |
| mercari.com | keyword | 89 | 50 (56%) | 47 (94%) | 0 | 17% | 0.2 / 1.8 |
| grailed.com | live | 232 | 149 (64%) | 149 (100%) | 9 (6%) | 80% | 3.6 / 4.3 |
| grailed.com | cached | 270 | 190 (70%) | 156 (82%) | 6 (3%) | 83% | 2.6 / 3.5 |
| grailed.com | keyword | 62 | 51 (82%) | 51 (100%) | 2 (4%) | 82% | 2.7 / 3.0 |
| facebook.com | all three | 0 | 0 | 0 | 0 | – | 1.8–2.2 / 2.3–3.0 |
| offerup.com | live | 300 | 202 (67%) | 202 (100%) | 126 (62%) | 0% | 3.4 / 4.2 |
| offerup.com | cached | 263 | 218 (83%) | 218 (100%) | 129 (59%) | 0% | 1.7 / 2.2 |
| offerup.com | keyword | 84 | 60 (71%) | 60 (100%) | 18 (30%) | 6% | 2.2 / 4.6 |

Most listing pages per query and site, best of the three modes *(observed)*:

| query | eBay | Poshmark | Depop | Mercari | Grailed | Facebook | OfferUp |
|---|---|---|---|---|---|---|---|
| band tee | 16 | 17 | 24 | 16 | 23 | 0 | 15 |
| Carhartt Detroit | 13 | 15 | 18 | 20 | 21 | 0 | 24 |
| Levi's 501 big E | 8 | 25 | 25 | 18 | 25 | 0 | 10 |
| Switch OLED | 16 | 19 | 10 | 20 | 9 | 0 | 22 |
| PS5 | 15 | 25 | 17 | 16 | 19 | 0 | 14 |
| Charizard | 11 | 25 | 20 | 17 | 13 | 0 | 25 |
| AJ1 size 10 | 5 | 17 | 24 | 20 | 24 | 0 | 17 |
| Synchilla | 4 | 14 | 16 | 20 | 13 | 0 | 15 |
| Poäng | 16 | 25 | 17 | 18 | 3 | 0 | 22 |
| KitchenAid | 10 | 24 | 14 | 12 | 12 | 0 | 22 |
| Coach bag | 5 | 18 | 21 | 16 | 22 | 0 | 19 |
| DSOTM SMAS-11163 | 9 | 20 | 20 | 11 | 6 | 0 | 17 |

What the numbers show:
- **eBay live mode is broken**: Exa's live crawl of eBay times out at about 10 s, and the results fall back to category pages (`ebay.com/b/...`) *(observed)*. Cached mode returns item pages. A category page's text does list current listings with prices (the Switch OLED category page text started with a "New Listing" at US $250) *(observed)*, which is a possible scraping route but not a listing feed *(inferred)*.
- **Depop pages carry no price or sold state** in Exa's text; the page text stops after size and condition *(observed)*. Depop renders those in the browser *(inferred)*.
- **Cached text understates sold items**: Poshmark showed 21% sold in cached text and 28% in live text *(observed)*. A Grailed listing my sold check passed as live in cached text was sold when opened *(observed)*.
- **Dates are missing**: only Grailed results carry a `publishedDate` (80–83%); every other site is under 17% *(observed)*.
- **Results vary between identical runs**: across 203 call pairs from two full runs an hour apart, the median overlap of returned URLs was 0.63 (Jaccard) and 15% were identical *(observed)*. One query got 25 eBay results in one run and 7 in the next *(observed)*.
- `/search` returns no per-result `statuses`, so I could not confirm which results in "live" mode were actually re-fetched *(observed)*.

## 5. Freshness against each site's newest-first page

At 20:48 UTC I read eBay's newest-first search (`_sop=10`, 60 per page) and Poshmark's (`sort_by=added_desc`, 48 per page) for four queries in the built-in browser. eBay's start times came from each item page's `startDate`; Poshmark's from the listing id, which is a MongoDB ObjectId whose first 8 hex digits are the creation time *(observed)*. eBay's 45th-newest listing was 11 hours old for Switch OLED and 9 minutes old for Coach bag; Poshmark's newest 48 spanned 12 days for Switch OLED and 2 hours for Coach bag *(observed)*.

Then I asked Exa for up to 100 results per site and query. Exa ran out of credits before the Coach bag calls, so three queries finished *(observed)*.

| query | site | mode | Exa listings returned | of the newest 60 (eBay) or 48 (Poshmark) | newest Exa listing's age |
|---|---|---|---|---|---|
| Switch OLED | eBay | live / cached | 1 / 59 | 0 / 0 | not measured |
| Switch OLED | Poshmark | live / cached | 57 / 91 | 0 / 0 | 18 days; median 137–163 days |
| Carhartt Detroit | eBay | live / cached | 0 / 75 | 0 / 0 | not measured |
| Carhartt Detroit | Poshmark | live / cached | 30 / 88 | 0 / 0 | 39–45 days; median 136–142 days |
| Synchilla | eBay | live / cached | 0 / 82 | 0 / 0 | not measured |
| Synchilla | Poshmark | live / cached | 40 / 86 | 0 / 0 | 44 days; median 126–129 days |

None of the returned Poshmark listings was under 7 days old *(observed)*.

**Exact-title probe.** For 15 eBay listings posted 0–2 hours earlier, I searched Exa with each listing's exact title on ebay.com: 0 of 15 came back *(observed)*. Asking `/contents` for those 15 item URLs directly: 2 of 30 fetches returned text; the other 28 failed with `CRAWL_LIVECRAWL_TIMEOUT` after about 10 s *(observed)*.

## 6. Sold comps

| Route | Result |
|---|---|
| eBay item pages in ordinary results | 18 of 180 eBay item pages returned across all runs read "This listing sold on <date>" with a price, for example a Carhartt J97 PTL at US $427.50 *(observed)*. These are usable comps, but only as many as Exa happens to hold, and Exa cannot be asked for them by date. |
| Query with "sold", eBay only | 7–25 results; mostly unsold item pages, category pages and store pages *(observed)* |
| `includeDomains: ["ebay.com/sch"]` | 23 saved eBay search pages for unrelated queries (nano puff, torrentshell, pearl snap) *(observed)* |
| `/contents` on eBay sold-search URLs (`LH_Sold=1&LH_Complete=1`) | 1 timeout; 1 eBay login page and 1 "verify it's you" security page, both in Korean *(observed)*; Exa's crawler appears to reach eBay from Korea and is challenged *(inferred)* |
| 130point.com, by search | 15–18 results, all the home page, blog posts, checklists and the `/sales/` shell; no sale records *(observed)* |
| `/contents` on `130point.com/sales/?q=charizard` | live: timeout; cached: the home page's "Featured Auctions", not the query *(observed)* |
| Open web, "Carhartt Detroit jacket J97 recent sold prices" | 14 results: Grailed listings, one eBay UK item, price guides (Nostos, Comparemag) *(observed)*. Guides are useful context, not comps *(inferred)*. |

So Exa gives some sold comps by accident and none on purpose. *Agent proposal:* sold comps come from eBay's own sold data (Marketplace Insights or a browser read of the sold search, both untested here), with Exa sold pages as a supplement.

## 7. Structured extraction with `/contents`

Ten listing URLs from step 4, one call each: `maxAgeHours: 0`, `summary.schema` = {title, price, currency, size, condition, sold}. I checked each against the page's own JSON-LD `Offer` (price, currency, availability) and visible text in the built-in browser *(observed)*.

| Listing | Exa | Page | Correct? |
|---|---|---|---|
| eBay Coach bag | no output: live-crawl timeout | US $90, in stock, new | failed |
| eBay item 167003929710 | no output: live-crawl timeout | eBay returned 403 to the browser | failed, page unverified |
| Poshmark Xbox Series S | $178 USD, not sold | $178, InStock | yes |
| Poshmark Levi's 501 | $20, sold, W26 L32 | $20, OutOfStock, "This item is sold" | yes |
| Mercari Charizard | $6, new, not sold | $6, InStock, new | yes |
| Mercari Carhartt | $203.06, sold, L (42-44) | $203.06, SoldOut | yes |
| Grailed Synchilla | $380, sold | $380, SoldOut | yes |
| Grailed Levi's 646 | $250, sold | $250, SoldOut | yes |
| OfferUp Synchilla bundle | $60, **sold** | Cloudflare blocked the browser; Exa's own text has no SOLD line | sold flag likely wrong *(inferred: "Sold by" read as sold)* |
| Depop Nirvana jersey | £84 GBP, **sold** | £84, InStock | sold flag wrong |

Price and currency: 8 of 8 that returned output were right. Sold flag: 6 of 8 right, 1 wrong, 1 likely wrong. Two of two eBay pages failed. Latency 1.8–3.3 s per non-eBay page, 10 s to the eBay timeout *(observed)*. Titles kept the site suffix ("| Poshmark") *(observed)*. *Agent proposal:* trust Exa's price, but decide sold state from the page's JSON-LD `availability` where we can fetch it.

## What failed or was not tested

- Webhook delivery and signature: not observed (see section 3).
- Exa credits ran out at the end (`402 NO_MORE_CREDITS`). The Coach bag freshness calls failed, and the two monitors' later runs will fail until the account is topped up *(observed for the calls; inferred for the monitors)*.
- Calls through this machine's network proxy were cut off mid-response 9 times in 252; outside the proxy all 252 succeeded *(observed)*. Run 1 (through the proxy) agreed with run 2 in direction; the tables use run 2.
- Age of the eBay items Exa returned: not measured; I could not read their start dates in bulk.
- The live-versus-cached comparison is weak: a cached call made right after an identical live call returned in about 0.1 s with the same results, which suggests Exa caches whole queries *(observed timing; inferred cause)*.
- One marketplace per query and four queries for freshness; Mercari, Depop and Grailed freshness were not measured against their own newest sort.

## Log

Queries, the newest-first captures and every response: `~/secondhand-exa-raw/` (`coverage/`, `coverage-run1/`, `freshness/`, `sold/`, `extract/`). Re-run with `RAW_DIR=~/secondhand-exa-raw python3 run.py coverage|freshness|sold|extract <urls.json>|analyze`.
