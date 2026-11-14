# Watch and alerts
Status: draft, *agent proposal* except where a line links a decision. Slug: watch. Written 2026-11-14.

The hassle: today a person who wants a used thing at a fair price refreshes five apps, sets saved searches that each speak a different filter language, gets the same couch alerted three times, and still misses the good one by an hour. Watch lets them say what they want once, set the most they would pay, and hear about one real match, once.

## What the person does and sees

Lives in the Buy tab, on the Watching shelf ([decision](../../product/decisions.md#2026-11-14-the-buy-tab-mirrors-sell-with-shelves)). Alerts land as Today cards and notifications.

| Step | The person | They see |
|---|---|---|
| 1 | Types a want in the Buy search box, takes a photo, or pastes a link ([search box words](../../product/words.md#2026-11-14-search-box)). ＋ "Find this" opens the same thing ([decision](../../product/decisions.md#2026-11-14-the-bottom-bar-is-today--sell----buy--you)). | Live results (the buy spec), and a "Watch" button. |
| 2 | Taps Watch. Answers up to 3 tap questions, only those that change which listings match: size, condition floor, ship or pickup radius, variant. | Chips, prefilled from the search and their profile; "measured", "estimated" or "you said" on each. |
| 3 | Sets the most they would pay (delivered). Suggested from the valuation range. | One number with the fair range under it. |
| 4 | Leaves. | The want on the Watching shelf with when it last checked each site. |
| 5 | Gets an alert. | One card per item: photo, delivered total, the site, "also on" other sites, why it fits, Open on site. |
| 6 | Unsure match (score 0.6 to 0.8). | A "Same thing?" Today card, yes or no; the answer is a label. |
| 7 | Pauses, edits or deletes the want; sets quiet hours. | Quiet-hours alerts arrive as one digest. |

For clothes, fit is measured: the person picks a garment they own and like (captured on the Sell side, or entered once), and a listing fits when its stated measurements are within tolerance of that garment, not only when the size label matches ([analytics note, section 5](../../research/data/nate/analytics-and-recommendations.md#5-recommendations-how-marketplaces-personalise-and-cold-start), *asserted*). Listings with no measurements show "size only".

Where Ben's design makes a person stumble:
- "Within the hour" is the promise on the card ([decision](../../product/decisions.md#2026-11-14-the-buy-tab-mirrors-sell-with-shelves)), but nothing has been run yet. Facebook listings show up in search about 7 minutes late, and Exa can run hourly at best and slips 30 minutes. If a site is slow or blocked, the promise breaks with no sign to the person. Proposal: each want shows "checked 4 min ago" per site and says plainly when a site is behind.
- New matches and Watching overlap: a match for a watched want belongs on both shelves. Proposal: New matches holds unseen matches across all wants; Watching holds the wants themselves.

What the backend makes possible that the design does not use yet: one alert per physical item across sites (dedupe), the delivered total rather than the asking price, and a watch created automatically when the person sells something they will need to replace (buy spec).

## What it reads and writes

| Entity | Fields used here |
|---|---|
| `want` | `id want_`, `user_id`, `source typed|photo|link|replace`, `product_id?`, `query`, `constraints {size, fit_ref_item_id?, condition_min, radius_km, ship_ok, pickup_ok, variant}` each as a provenance value, `max_total` (cents, currency), `sites[]`, `schedule {per_site_interval_s, quiet_hours}`, `state`, `last_checked {site: at}` |
| `match` | `id`, `want_id`, `site`, `site_id`, `url`, `cluster_id`, `total {price, shipping, shipping_known}`, `measurements[]`, `match_score`, `deal_score`, `trust`, `fresh_at`, `seen`, `alerted_at`, `alerted_total`, `saved`, `display_group` |
| `product`, `valuation` | Read from the price engine for fair value per site. |
| `item` | Read only, as the fit reference garment. |
| `limits` | The buy ceiling (`max_total`) lives here per want. |
| `decision` | Kind `same_item` for unsure matches. |
| `event` | `want.created`, `watch.ran`, `match.found`, `match.alerted`, `match.labelled`; ids only. |
| `comp` (Delta) | Every listing seen is also a comp (asking price, date, rights note). |

## States

| Thing | States | Moves on |
|---|---|---|
| want | `active`, `paused`, `fulfilled`, `deleted` (*agent proposal*) | person taps; "Bought it" on a match sets `fulfilled` |
| match | `found`, `alerted`, `dismissed`, `saved`, `gone` (sold or removed) (*agent proposal*) | watch run, re-fetch before alerting, person taps |
| watch run (`job`, kind `watch_run`) | stages `fetch`, `normalise`, `dedupe`, `score`, `alert`, each `started, running, arrived, failed` | Lakeflow schedule |

## Systems underneath

| Piece | Does here |
|---|---|
| Firecrawl monitors | Each site's newest-first search page, per grouped want ([decision](../../product/decisions.md#2026-11-14-watch-alerts-run-on-firecrawl-the-ebay-api-and-a-facebook-search-api)). |
| eBay Browse API | `sort=newlyListed` searches. |
| Facebook search API (ScrapeCreators) | Facebook Marketplace listings near the person. |
| Exa | The long tail only. |
| Own scrapers, Apify | Fallback per site when the above fails ([routes](../../research/watch/ben/fanout-and-watch-loop.md#per-platform-search-routes)). |
| Lakeflow job | One `watch_run` per site per interval; identical wants grouped into one query; a seen set keyed on `(site, site_id)`; the first run seeds silently ([watch loop](../../research/watch/ben/fanout-and-watch-loop.md#the-watch-loop)). |
| Lakebase | `want`, `match`, seen sets. Delta for comps and events. |
| Rules, then models | Rules filter first (price, size, radius, live). Only uncertain listings go to a model, at most 20 per request, cached by want, listing and evidence read ([harness lessons](../../research/cross-cutting/ben/ai-harness-from-repos.md#2-decision-questions-the-jev-lessons)). Text match runs on the Decisions API and Jev, and our labels pick ([decision](../../product/decisions.md#2026-11-14-typed-judgements-run-on-both-the-decisions-api-and-jev-and-our-labels-pick)); image match is a separate decision with its provider open ([decision](../../product/decisions.md#2026-11-14-image-decisions-and-text-decisions-are-separate-and-the-provider-for-each-stays-open)). |
| AI Search | Similar-item retrieval for photo wants and dedupe candidates. |
| MLflow 3 | A trace per run; "why this alert?" opens it. |

Dedupe ([note](../../research/watch/ben/fanout-and-watch-loop.md#dedupe-of-cross-listed-items)): block by product cluster and a price band, then perceptual photo hash (near-identical means same item, a middle band asks); a stock photo used by several sellers counts as no evidence. The card shows the cheapest copy with "also on".

Deal score ([note](../../research/watch/ben/fanout-and-watch-loop.md#ranking-against-fair-value)): how far the delivered total sits under the middle of the fair range, scaled by the range's spread, times match, seller trust and freshness. Plain code.

Alert rule, in code: `total <= max_total AND match >= 0.8 AND fits AND live`, re-fetched just before sending. One alert per (want, cluster); a re-alert only when the total drops below the last alerted total. With no ceiling, a drop of 10% or more below the lowest seen, on items of $10 or more.

## Contract for the frontend

| Call | Shape |
|---|---|
| `POST /v1/wants` | `{source, query?, photo_upload_id?, url?, constraints, max_total, sites?}` returns `{want, questions:[{name, options, suggested}]}` |
| `PATCH /v1/wants/:id` | constraints, `max_total`, `state`, `schedule.quiet_hours` |
| `GET /v1/wants` | each with `last_checked` per site and `behind:[site]` |
| `GET /v1/wants/:id/matches?state=` | matches with `total`, `match_score`, `deal_score`, `also_on:[{site,url,total}]`, `fit {method: measured|label, delta_cm?}` |
| `POST /v1/matches/:id/act` | `{action: dismiss|save|not_same|bought}` |
| `GET /v1/jobs/:id/events` | SSE for a manual "check now" |
| Decision kind | `same_item`: options `same`, `different`. |

Errors use `{code, message, failed_step, retry}`; `site_behind` and `site_blocked` are codes, never shown as raw text.

## Who may act

| Action | Mode |
|---|---|
| Searching sites, reading listings | `auto` (read only, under the person's own account where a site needs a login) |
| Sending an alert | `auto` inside the want's ceiling and fit |
| Saving a match on the site (like, watch) | per the buy spec |
| Asking a seller or offering | per the buy spec |
| Completing a purchase | locked, always the person |

## How it fails

| Failure | The person sees | Recovery |
|---|---|---|
| A site route breaks (doc id change, Cloudflare) | "Facebook: behind" on the want | Fallback route; a run alert to us after 2 missed intervals |
| The match was sold before the alert | Nothing (re-fetch drops it) | `gone` |
| Same item from two sites | One card, "also on" | Dedupe; a wrong merge undone by "not the same" |
| Model unsure | A "Same thing?" card | The answer is a label |
| Too many matches | A digest, not 30 pushes | Batching per want |
| Facebook local listing with no shipping | "pickup, {distance}" instead of a total | `shipping_known=false` |

## How we will know it works

| Claim | Check |
|---|---|
| "Within the hour" | Median and 95th percentile of `match.alerted.at - listing posted time`, per site, on 20 real wants over a week. The promise holds only if p95 is under 60 minutes. |
| One alert per item | Share of alert pairs that a person labels the same item: under 2%. |
| Matches are right | Precision of alerts on 50 hand-labelled matches: 0.9 or more. Dedupe calibrated on about 50 labelled pairs. |
| Fit | Of clothes bought from alerts, share kept (not returned for fit), from "Bought" follow-up. |

## Facts that constrain it

- Exa has no Facebook listings, few eBay ones, nothing under 7 days old, many already sold; its price limits are words ([exa-empirical](../../research/watch/ben/exa-empirical.md), *observed*). No Exa setting makes monitors fresh ([monitor-alternatives](../../research/watch/ben/monitor-alternatives.md), *agent proposal*, untested).
- Per-site routes, intervals and the Facebook lag ([fanout-and-watch-loop](../../research/watch/ben/fanout-and-watch-loop.md#per-platform-search-routes)). No adapter has been run.
- eBay's licence limits how eBay data can be kept, shown next to other sites' and used for price models ([comps-sources-live](../../research/price/ben/comps-sources-live.md)). This affects mixed lists and the deal score on eBay items.
- Competitors check every 1 to 10 minutes ([fanout-and-watch-loop](../../research/watch/ben/fanout-and-watch-loop.md)), so "within the hour" is slower than the field.

## Demo path

For Ben and Nate to mark.

## Open for Ben and Nate

| Question | Recommendation | Depends on it |
|---|---|---|
| Is "within the hour" the promise, given checks every 5 to 10 minutes on the big sites and hourly at best on Exa? | Keep "within the hour" on the card only for sites whose measured p95 meets it; show "checked N min ago" everywhere. | Card copy, schedule cost |
| Is Mercari watched? Ben lists it ([words](../../product/words.md#2026-11-14-platforms)); Nate named "ebay, depop, poshmark, fb marketplace" ([words](../../product/words.md#2026-11-14-nate-vision)). | Watch Mercari (search is read only and cheap). | Routes |
| Can eBay matches appear in one ranked list with other sites given the licence? | Show eBay matches in their own group with their own score until checked with eBay's terms. | `display_group` |
| Business model: a faster check interval is the obvious paid tier. | Not picked. | |

## Needs from the shared model

- `want.source` (`typed|photo|link|replace`) and `want.state` (`active, paused, fulfilled, deleted`).
- `match` states (`found, alerted, dismissed, saved, gone`) and `cluster_id`, `alerted_total`, `display_group` (for the eBay licence).
- `limits.buy_ceiling` per want, not only per user.
- A fit reference: `want.constraints.fit_ref_item_id` pointing at an owned `item`'s measured attributes, or a stored body or garment measurement set.
- Decision kind `same_item`.
