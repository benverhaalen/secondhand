# Intelligence API engine

*agent proposal* (the whole file). Canon names in [product.md](../product.md) win. This engine is the planner, fetch, extraction and gathering layer under the [information engines](../product.md#information-engines-agent-proposal) and the [public API](../product.md#public-api-agent-proposal-on-the-shape-public-by-nates-words). It takes a typed or plain question, or a target (a link, a photo, a product), and returns a structured, sourced answer: the first answer inside the person-facing budget, the settled answer behind it, and more gathering when a number would otherwise hide. It is built from the four repos read in [the research note](../../research/data/nate/intelligence-api-from-four-repos.md), as Nate asked in his [words](../../product/words.md#2026-11-14-nate-our-own-intelligence-api-from-four-repos), and holds his rules on [gathering more](../../product/words.md#2026-11-14-nate-our-own-gathering-solves-not-finding-enough-to-weigh-a-claim), [a protocol per question type](../../product/words.md#2026-11-14-nate-protocols-per-question-type-every-target-in-parallel) and [the finalised engine](../../product/words.md#2026-11-14-nate-finalised-the-intelligence-engine-the-listing-swarm-the-buying-engine-and-how-capture-works). Firecrawl, crawl4ai and treg stay in the registry as measured routes; the engine itself is ours ([words](../../product/words.md#2026-11-14-nate-our-own-protocol-official-apis-last)).

## 1. What it decides

For each question, the engine decides:
- which kind the question is;
- which targets to call, each with what deadline and budget;
- what each page says;
- which results are the same product, and which of them to keep;
- how sources that disagree are reconciled;
- when the answer is settled;
- whether a number the hide rule would hide becomes a `gather_request{product, claim, deadline}`.

**The answer** is a new name, `answer`:

```
answer {
  id, kind, slots{}, protocol_version,
  facts[ {name, value | range{low, high}, unit,
          guarded{state, basis_count, as_of, citation_id, hide_reason?},
          sources[ evidence ] } ],
  found{sources_searched, results_found, results_used, dropped_by_reason{}, sites{}},
  searched[ {route_id, query, outcome: hit | empty | blocked | timeout | over_budget, ms} ],
  stage: first | late | settled | gathering,
  ms{first, settled, gathered?},
  gather?{request_id, deadline, steps_done[]}
}
```

- `sources[]` uses the canon comp `evidence`: `{source_url, read_at, snapshot_ref, fingerprint, extractor_version, rights}`.
- `found{}` is the canon search contract from [§7](../product.md#7-contract-conventions).
- "Not found" is a fact with the state `not_found` and its `searched[]` list, never an error. This follows Firecrawl's `{product: null}` rule.
- The answer streams on the canon [job stream](../product.md#jobs-and-the-event-stream). There are four new event names, each carrying the whole `answer`:
  - `answer.partial` when a target arrives before the answer settles;
  - `answer.settled` when every target has ended or the budget is spent;
  - `answer.late` when a target arrives after that;
  - `gather.update` after each gathering step.

**The protocol** is a data row in Lakebase beside `route_table`. It is versioned, and it changes only by review:

```
question_protocol {
  kind, version, slots_schema, facts_schema,
  targets[ {target_id, route_need{layer, verb}, query_template, extractor_id,
            deadline_ms, budget{calls, cents}, feeds[fact]} ],
  budget{first_ms, settled_ms, cents}, stop_rule, calculation_id,
  freshness{fact: seconds}, gather{deadline_s, steps[]}
}
```

Target order, `deadline_ms` and `extractor_id` are params (§4). The rest of the row is reviewed.

### The question kinds

The budgets are p95 starting values. Jev counts are requests, and one request carries every head. LLM counts are calls on a warm template; a template the engine has never seen adds 1 to 4 calls once, for its schema (§3.2).

| Kind | Slots | Targets | First | Settled | Jev | LLM |
|---|---|---|---|---|---|---|
| `price_now` | product or text, condition?, size? | index; sold and active reads on the five marketplaces; accepted-offer source; price history; retail | 1.5 s | 10 s | 0 to 1 classify, plus 1 per 20 unresolved results | 0, plus 1 cached explanation |
| `sold_history` | product, window | index; marketplace sold reads; accepted-offer source; archives | 1.5 s | 10 s | 1 per 20 unresolved | 0 |
| `retail_price` | product | brand store; retailers for the kind family; Amazon; price history | 3 s | 20 s | 1 to 3 | 0 to 1 (a page with no structure) |
| `identify` | photo or link | the [identity engine](identity.md), with lookups from this engine | 3 s | 15 s | the identity engine's own | 0 |
| `listings_matching` | text or product, filters | the five marketplaces' search; retail | 3 s first batch | 10 s last site | 1 per 20 unresolved | 0 |
| `available_now` | product or text, size?, condition floor?, ship_to | index offers; the five marketplaces; the official brand store; retailers; Amazon | 3 s | 10 s | 1 per 20 unresolved, plus 1 variant check | 0 |
| `product_reviews` | product | retail review blocks; brand store; review sites; the open-web engine | 3 s | 20 s | 1 per 20 pages (same product) | 1 (themes) |
| `seller_reviews` | site, seller | site protocol reads of the seller's page | 1.5 s | 5 s | 0 | 0, or 1 when there are more than 10 comments |
| `site_rules` | site, kind family | reviewed rule and fee rows; a change check on the site's rule pages | 1 s | 5 s | 0 | 0, or 1 to summarise a changed page for review |
| `trend` | product or family | the [demand and trend engine](demand-and-trend.md)'s signals | 3 s | 20 s | 0 to 1 | 0 |
| `used_vs_official` | product | `available_now` and `retail_price` run as one plan | 3 s | 20 s | as those two | 0, plus 1 cached explanation |
| `listing_swarm` | item, confirmed identity | eight specialists, written out below | 3 s | 20 s | 2 to 4 | 0 to 1 |
| `my_analytics` | metric, window, storefronts? | the person's own tables; a storefront sync when one is stale | 1 s | 5 s | 1 (metric and window heads) | 0, plus 1 cached explanation |
| `general` | text | the open-web engine: search, then an adaptive crawl | 3 s | 20 s | 1 to 3 | 1 to 3 |

Each budget matches an existing one:
- `listings_matching` matches product.md's search row;
- `identify` matches [identity §5](identity.md#5-speed);
- `listing_swarm` matches [marketing engine §4](../marketing-engine.md#4-speed);
- the 20 s settled budgets match the information engines' completion deadline.

### Three protocols in full

**`price_now`**

```
slots: {product_id | text, condition?, size?, region (from the account)}
facts: {sold_range, ask_range, new_reference, accepted_offer_ratio?}
targets:
  t1 index.comps      layer index          extractor none     deadline   150 ms
  t2 site.sold   x5   site_protocol.read   extractor adapter  deadline  2500 ms  1 call each
  t3 site.active x5   site_protocol.search extractor adapter  deadline  2500 ms  1 call each
  t4 accepted_offers  engine.fetch         extractor schema   deadline  4000 ms
  t5 price_history    engine.fetch         extractor schema   deadline  4000 ms
  t6 retail           engine.search+fetch  extractor ladder   deadline  6000 ms  feeds new_reference
budget: first 1500 ms, settled 10000 ms, ceiling 2 cents
stop: every target ended, or 10 s
calculation: valuation (money D1 to D5)
freshness: ask 15 min; sold 24 h, append only; retail 24 h
gather: deadline 120 s, steps 1 to 6 (§3.5)
```

**`listing_swarm`**: when a listing is about to be made. Eight specialists start at once, and each returns one typed result into `swarm_result`, a new name:

| # | Specialist | Returns | Source | Deadline |
|---|---|---|---|---|
| 1 | Exact identity | `product_id`, match label, variant | identity engine | 3 s |
| 2 | Comps and sold history | the `price_now` answer, as a nested question | §3 | 10 s, gather 120 s |
| 3 | Current winners per site | the top listings for this product on each of the five, with views or sold where shown | index, then a fresh site search | 3 s from the index, 10 s fresh |
| 4 | Title and attribute terms per site | terms with frequency in winners; the site's required and optional attributes | winners (3), plus the site's attribute taxonomy read | 10 s |
| 5 | Photo requirements per site | count, ratio, background and cover rules | reviewed rule rows; the [photo engine](photo.md) | 1 s |
| 6 | Rules and fees for this kind per site | fee lines, listing limits, restricted-item rules | `site_rules` | 1 s |
| 7 | Demand and trend | the demand and trend engine's numbers for the product | that engine | 3 s, 20 s settled |
| 8 | Risk | recall flags, authenticity-required categories, a site's brand-rights rules, counterfeit-prone models | reviewed lists; the [trust engine](trust.md) | 5 s |

The merge is a join by site in code, never a model:

```
swarm_result{product_id, identity, comps, demand, risk,
             per_site{site: {winners[], terms[], photo_rules, rules, fees, blocked?}}}
```

- A risk that blocks a site sets `blocked` on that site before the [marketing engine](../marketing-engine.md) reads the result. The marketing engine never plans a blocked site.
- The marketing engine plans first at 3 s from whatever has arrived, which is the index rows for 1, 3, 5, 6 and 7, and re-plans on every `answer.partial`.
- Fees, limits and rules come only from reviewed rows. They are on the never-learned list in [real-time weights](../product.md#real-time-weights-agent-proposal).

**`available_now`** (the buying engine)

```
slots: {product_id | text, size?, condition_floor?, ship_to (from the account)}
facts: {offers[offer_view + availability, variant, delivered_cents, delivery_min_days,
         delivery_max_days, source], best_by_relation}
targets:
  t1 index.offers       layer index           deadline   150 ms   fresh 15 min
  t2 site.search   x5   site_protocol.search  deadline  3000 ms
  t3 brand_store        engine.fetch          deadline  4000 ms   the official store, from the registry
  t4 retailers          engine.search+fetch   deadline  5000 ms   the registry's retailers for the kind family
  t5 amazon             engine.fetch          deadline  4000 ms
  t6 variant_check      Jev heads over size, colour and edition per offer
budget: first 3000 ms, settled 10000 ms, ceiling 2 cents
calculation: delivered price ([M26](../determinations/market-insight.md#m26-delivered-price)), one offer per relation
freshness: availability and price 15 min, delivery 24 h
gather: none for prices; an empty result is "not found" with what was searched
```

`product_reviews` returns:
- a count-weighted aggregate rating across sources, with the count;
- the recurring praise and complaints, as at most 5 themes each, with counts.

The themes come from one LLM call over the batched review text. The check is that each theme cites review ids that exist in the batch; a theme that fails is dropped.

`seller_reviews` returns the feedback score, the count, and the latest comments where a marketplace shows them.

`my_analytics` reads the person's own listings, sales and offers across every storefront from our own tables first, with the metrics defined in the [analytics suite](../features/insights.md#analytics-suite-agent-proposal):
- A storefront whose last sync is older than 15 minutes gets a read through the person's own session.
- It is never served on the public API.
- It is never cached across people.

## 2. Signals

| Signal | From | Used for |
|---|---|---|
| The question: a typed body, plain text, a link, a photo | the caller | classification and slots |
| `route_table`, `route_call`, `route_truth`, `route_probe` | the [registry](../features/data.md#source-registry-and-router-agent-proposal) | route order, p95 per route, `right_90d`, cost, health |
| Standing index rows with `seen_at` and `next_check_at` | the information engines | answering fresh facts before any target is called |
| Snapshots, fingerprints, ETag and Last-Modified | the fetch layer | revalidation with a 304, and change detection |
| `extractor_schema{template_key, schema, version, missing_field_rate}`, a new name | the extraction ladder | extraction with no model |
| Params: target order, deadlines, contribution Betas | the param rows, through the 60 s cache | the plan |
| Comps with `n_eff` and sold in 90 days | [money D1](../determinations/money.md#d1-comparable-set-and-weights) | the basis test that starts gathering |
| Our labels on same product and on keep or drop | the identity engine, and taps | choosing the champion for each decision head |
| Leases and pace | [sessions](protocol-and-adapters.md#31-sessions) | signed-in reads |
| The person's own tables | Lakebase and Delta | `my_analytics` |

## 3. The calculation

### 3.1 Plan and run

1. **Classify.** Rules come first. A typed body names its kind; a link, a barcode, or words such as "worth", "sold", "reviews", "in stock" or "my sales" match a kind. When no rule matches, one Jev request runs with a `kind` head over the catalogue and enum slot heads for condition and site.
   - The answer is checked as in jev-ultrafast `validate_choice`: the choice is in the set, the probabilities cover the set and sum to 1 within 0.02, and the choice is the largest.
   - The answer is accepted when the top probability is at least 0.85 with a lead of at least 0.5.
   - Otherwise the question runs the `general` plan and writes a `protocol_candidate{text, top_kinds, answer_id}`, a new name.
2. **Fill slots.** Code parses the slots. Free text, such as a description, is kept verbatim. A missing required slot is a 400 that names the slot on the API; in the app, it becomes a generated input in the prompt.
3. **Index first.** Any fact in the index that is fresher than `freshness[fact]` is answered at once, and its targets leave the plan. A repeat question still runs a change check for its delta.
4. **Launch every target at once.**
   - Each target's deadline is `min(deadline_ms, settled_ms, 2 x route p95)`.
   - Inside a target, the routes run as a hedged waterfall, as in Firecrawl. When the running route passes its p95, the next route starts in parallel; the first good result wins and the others are cancelled.
   - Route order follows the [router](../product.md#source-router-agent-proposal): on the five marketplaces, our own adapter, then the fetch engine, then official. On the open web, the index, then plain fetch, then rendered fetch, then the browser agent.
5. **Single flight and cache.** A map keyed by `(route_id, normalized query)` lets a second question in flight join the first one's call. The cache is keyed by `(target_id, normalized query)`, and each fact has its own freshness.
6. **Priority.** There are three classes: a person is waiting, background gathering, index refresh.
   - A job that has waited 30 s moves up one class, so no class starves.
   - Each route has a semaphore, and each domain a rate limiter, as in crawl4ai: a 1 to 3 s base, backoff on 429 and 503, and a ceiling of 60 s.
7. **Stream.** Each arrival reruns the kind's calculation, which is arithmetic over at most a few hundred rows in under 20 ms, and emits `answer.partial`. Nothing waits on the slowest source.

### 3.2 The extraction ladder

Each page takes the first rung that yields a valid `facts_schema` row:

1. Structured data on the page: JSON-LD, microdata, OpenGraph, embedded state JSON. No model.
2. A cached `extractor_schema` (CSS or XPath) for the page's `template_key`, which is the domain, the shape of the path, and the head fingerprint. No model.
3. No schema yet. An LLM writes one, as in crawl4ai `generate_schema`: it is validated on the page and refined up to 3 times, then stored, so every later page of that template runs on rung 2.
4. The schema cannot validate. An LLM extracts the page text straight into `facts_schema`, with pages batched up to the call's token budget.

A template's schema is regenerated when its missing-field rate passes 0.2 over its last 50 pages, or when `route_truth` disagrees with it. A field that fails the schema is dropped, and the drop is counted in `dropped_by_reason`.

### 3.3 Same product, keep or drop, reconcile

- **Same product.** The identity engine's identifiers and pair score decide first. Only the band the code cannot settle goes to Jev, in one request per 20 results, with two heads:
  - `match`, over the canon match labels;
  - `keep`, over keep, `wrong_item`, `duplicate`, `bundle`, `spam`.

  Per the [decision](../../product/decisions.md#2026-11-14-typed-judgements-run-on-both-the-decisions-api-and-jev-and-our-labels-pick), each head runs on both the Jev and the Decisions API, and our labels pick the champion.
- **De-duplication.** By listing id within a site, then across sites by image pHash with the seller and the price, so a crosslisted copy counts once.
- **Numeric conflicts.** Code settles these. Each value is kept with its source and weighted by the route's `right_90d`.
- **`mixed_types`.** Split by variant through [D2](../determinations/money.md#d2-condition-variant-completeness-and-size-adjustment) before the guard.
- **A text conflict that code cannot settle**, such as two sources giving different specs, goes to one LLM call. The call reads both snippets and returns one of the given values with a reason; a value that is not one of the inputs is rejected, and the fact stays `conflict`.

### 3.4 Which model does which step

| Step | Model | Calls |
|---|---|---|
| Classify the kind; enum slots | rules, then Jev (kind and slot heads in one request) | 0 to 1 per question |
| Order and choose targets | code from params; Jev chooses among targets only in `general` | 0 to 1 |
| Pick the element on a page | Jev in the browser agent loop: code builds the choices, Jev picks, code confirms; [primitives](protocol-and-adapters.md#32-the-primitives) | per step, bounded at 120 decisions per run |
| Same product; keep or drop | identity code, then Jev | 1 per 20 unresolved results |
| Extraction | none on rungs 1 and 2; an LLM on rungs 3 and 4 | 0 on a warm template |
| Reconcile a text conflict | LLM, the choice checked against the inputs | 0 to 1 |
| Review themes | LLM | 1 per `product_reviews` |
| The explanation a person reads | LLM, cached by fact fingerprint | 0 to 1 |
| Text typed into a site's form | code from the slots; jev-ultrafast `field_text` only when a form needs prose | 0 |

A Jev answer that fails validation runs nothing. The decision falls to the code default, which is `unresolved` with the result kept out of the basis.

### 3.5 Gathering more

The settled answer passes the guard.
- **too_few, stale, source_gap or noise.** A fact that would hide for one of these reasons becomes a `gather_request{product, claim, deadline}` and runs as a background job.
- **conflict.** Reconciled first (§3.3).
- **mixed_types.** Split by variant first.

A fact still hidden after reconciling or splitting gathers.

Each step widens the search, reruns the calculation and the guard, and emits `gather.update`:

1. More sources and deeper pages: more result pages, more query variants per marketplace, and an adaptive crawl that follows the 3 best links per page.
2. Adjacent variants and conditions with the D1 and D2 adjustments, which are D1's back-off levels.
3. Older sales under `w_age`: a half-life of 90 days, 30 days in fast categories, cut at 365 days.
4. Other sites, through the open-web engine's search waterfall.
5. Retail and price-history sources.
6. A signed-in read through the site protocol, within its pace and leases.

Gathering stops at the first of these:
- the basis is met: `n_eff >= 6` and at least 2 sold in 90 days;
- saturation: as in crawl4ai, saturation is 0.8 or more, or the last step gained less than 0.1 of `n_eff`;
- every source in the plan has been tried;
- the deadline passes, a param starting at 120 s.

In the product (integration lead, 2026-11-15; fix J1 in [joins.md](../plans/joins.md#named-fixes-in-build-order)): gathering is started by the valuation route when `valuate(item, ctx)` returns a `gather` request, and by nothing else yet. The route runs the request as one `runPlan` over the same source rows a search uses. Every row a search, a gather step or a valuation reads goes through one observation writer (`app/src/edge/events/observations.ts`) into the Store's `observation` table, under the asking person's `user_id`, with the comp `evidence` shape inside it. Dupe rows are not written. The next valuation reads those rows back through `ctx.observations`, so a repeated question is answered from what was gathered. Today `gather.ts:51` gathers only for a hidden fact, and `gather.ts:47` computes the effective sample by a different formula than valuation (both are the engines lead's, in eng-intel-1).

The number is never held back while gathering: it is given from the next step of its fallback order ([valuation §3](valuation.md#3-the-calculation)) with its `searched[]`, and replaced in place when the gather settles. It hides only when no level can state it. "Not found" is then the evidence that the item is rare, and it is shown as such.

## 4. Learning

- **Contribution.** Each `(protocol, target)` has a Beta of contribution: a success is a result that the settled answer used.
  - When a kind's cents ceiling binds, the targets with the lowest `E[contribution] / (p95_ms x cents)` are cut first.
  - Each target's deadline is tuned to the 90th percentile of its contributing arrivals.
  - Both stay inside the ±50% guards on [real-time weights](../product.md#real-time-weights-agent-proposal).
- **Extractors.** These run as champion and challenger, scored against `route_truth`. The challenger is promoted when it is right on 2 points more of pages over 200 pages.
- **The classifier** learns from a caller who sends the kind explicitly, and from a person who rephrases after an answer.
- **New kinds.** `protocol_candidate` rows are clustered weekly, and a person reviews a cluster into a new `question_protocol`. A protocol is never written automatically.
- **The whole market.** Every page read feeds the standing index with `seen_at`, so the engine learns from the whole market and not only our users ([words](../../product/words.md#2026-11-14-nate-the-engine-learns-from-the-whole-market-not-only-our-users)).
- **Never learned:** fees, rules, limits and the rest of the canon never-learned list.

**Test:** a replay of 500 logged questions with the tuned params against the starting params keeps the used-result count and lowers the cents per answer.

## 5. Speed

| Step | Budget (p95) | Kept warm |
|---|---|---|
| Index answer | 150 ms | the standing index; `extractor_schema`; params through the 60 s cache |
| Jev request | 400 ms (jev-ultrafast published a 178 ms median; our traces replace both numbers) | one HTTP/2 connection |
| Calculation per arrival | 20 ms | the comp set ids per product |
| First answer | per kind, in the table in §1 | route p95 and session leases |
| Settled answer | per kind, in the table in §1 | the same |
| Repeat question | under 1 s, with its delta in 5 s | the cached answer and its fingerprint |
| Gathering | 120 s deadline | none; it runs as a background job |

**Test:** a load test runs 200 questions across every kind, with 20 in flight, and reads the first and settled p95 from the traces against the table.

## 6. What the person sees

- The answer fills in place as targets arrive. Each number carries its count and its sources, and a tap opens the snapshot.
- While gathering runs, the hidden number shows the sites it has searched so far, and the number appears when the basis is met.
- When gathering ends with no basis, the person sees the list of what was searched, never a bare "no data".
- `listing_swarm` is not shown on its own. It feeds the listing plan the person sees.
- API callers get the same `answer` object and the same event stream.
- The copy follows [copy.md](../../product/copy.md).

## 7. How it beats what exists

The rival entries come from [parity.md](../parity.md#cross-marketplace-search-and-similar-item-finders) and the research note (*inferred* where the rival's own code was not read).

| Exists | What it does | What we do |
|---|---|---|
| Firecrawl alone | fetch and extract one page or crawl one site | a protocol per question, every target at once, and an answer guarded by its basis |
| crawl4ai alone | extraction and an adaptive crawl in one process | the same ladder and stopping rule behind a registry of measured routes, with budgets |
| browser-use alone | one agent per task | the agent is one rung, called only where a page needs it, with Jev picking steps |
| jev-ultrafast alone | fast typed browser steps | the same typed decisions used across the whole engine: kind, match, keep |
| treg | a hosted registry of data routes | our registry measures `right_90d` and p95 per route; treg is one route in it |
| ThriftX | live search across resale sites | the same live search, merged by product and guarded, with the delivered price |
| Dupe | from an image to similar items | `identify` plus `listings_matching`, with the match label shown |
| Phia | where a price sits against the market | `price_now` with sold, asking and new prices, each sourced |
| Terapeak, 130point | sold history; accepted Best Offer prices | both as targets of `sold_history`, joined across five marketplaces |
| WatchCharts | thin-sales prices behind a publish gate | the same gate as the guard, plus gathering more instead of stopping |
| Keepa | price history that records only changes | the index stores only changes on `seen_at` for every source, not one store |
| RapidAPI health, the treg cost ceiling | route health; a spend cap | `route_probe` hourly, and a cents ceiling per question and per key |
| The OpenRouter traffic split | traffic shared across model vendors | each Jev and LLM head runs champion and challenger, and labels pick |
| Apify pay per result | a price per result row | cents per used result is our cost metric, and contribution cuts what does not pay |

## 8. Protections

- **Public API.** It serves only rows where `rights.may_share` holds. People's listings and `my_analytics` are never served. Keys and rate limits are enforced at the edge.
- **Outside text is data.** Fetched text never reaches a model that has tools. Prompt-injection flags from the extraction guard and the browser judge drop the page, and the drop is counted.
- **Validation.** Every extracted value is validated against `facts_schema`. An invalid Jev answer runs nothing.
- **Signed-in reads** for gathering are reads only. They run within the site protocol's pace and leases, under the account's own consent setting.
- **Politeness.** A rate limit and backoff apply per domain, with crawl4ai's layered block detector. A block marks the route in `route_call` and moves to the next route; it is not retried in a loop.
- **Spend.** A cents ceiling applies per question and per key. An over-budget target ends as `over_budget` in `searched[]`.
- **Logging.** Every outside call, decision and error is logged through [log/](../../log/README.md), and a snapshot with its fingerprint is kept for every page read.

## 9. Proof

| Part | Test |
|---|---|
| Classification | at least 95% on a labelled set of 400 questions across the kinds; every invalid Jev answer in a fuzz set of 1000 runs nothing |
| Streaming | a fixture with targets at 100 ms, 2 s and 12 s emits `answer.partial`, `answer.settled` at 10 s, then `answer.late` |
| Single flight | 50 identical questions in flight make 1 outside call per route |
| Extraction | after warm-up, at least 90% of pages are extracted on rungs 1 and 2; the schema field accuracy against `route_truth` is at least 0.95 |
| Reconciliation | a conflict fixture returns one of its inputs or `conflict`, never a new value |
| Gathering | on 300 products that the first pass hides, gathering leaves under 2% hidden, and each one still hidden lists what was searched |
| Listing swarm | the merge fixture yields one `per_site` row per site; a risk block removes its site from the marketing engine's input |
| Head to head | the same 200 questions through Firecrawl extract alone and through this engine: we answer more with a basis met, faster, at lower cost per used result |

## Open from the audit (checked 2026-11-15)

Each row of the Intelligence API section of [audit.md](audit.md) was checked against the code. 1 of 19 is closed (the OfferUp price now needs safe whole cents, `public/readers.ts:109`). 1 is unclear and 17 are open. Worst first. All paths are under `app/src/edge/intel/`.

| # | What is wrong | Where (file:line today) | Fix | Test that proves it |
|---|---|---|---|---|
| IN-A1 | Rung-4 grounding checks strings only. A model-invented number (price, count) passes and can feed computed money. | `extract.ts:348` | Require each numeric field to have a parseable span in the page text. | Page text has "$45". A row with `price_cents` 4500 is accepted. A row with 9900 is dropped as `ungrounded:price_cents`. |
| IN-A2 | A comp with no sale date counts at full weight, a future date counts as age zero, and `sold_90d` counts future rows. | `gather.ts:39` | Reject undated and future sold rows and validate prices. | One undated comp and one dated tomorrow: both excluded and counted as dropped. `n_eff` is 0. |
| IN-A3 | Numeric reconciliation accepts NaN values and reliability weights outside [0,1]. | `reconcile.ts:134` | Validate finite values and weights in [0,1] before the weighted pick. | Values [NaN, 100] raise. A weight of 1.5 raises. |
| IN-A4 | `calculate()` can return raw facts and the runner emits them with no answer or guard step. | `run.ts:156` | Pass every numeric fact through the proof publication boundary before emitting it. | A plan returning a fact on 1 row emits it with `too_few` notes. With 6 fresh rows it emits a shown number with a citation id. |
| IN-A5 | `n_eff` is the sum of age weights. Valuation and proof use the Kish count, so one comp set passes different gates. | `gather.ts:47` | Reuse `basisOf` from the proof layer. | Weights [1, 1, 0.1, 0.1]: `measure` returns the same `n_eff` as `basisOf` (2.396 by Kish, 2.2 today). |
| IN-A6 | Saturation uses the last inserted comps, so the same set in another arrival order stops at a different stage with a different median. | `gather.ts:44` | Sort comps by a stable id before the median, or version the snapshot. | The same 8 comps in two arrival orders give the same `saturated` flag and median. |
| IN-A7 | The first route to hit wins, so scheduling picks the numeric source. | `run.ts:138` | Freeze the observations and reconcile them under a stable source policy. | Two routes hit with 10000 and 12000. Swapping their arrival order gives the same `route_id` and price. |
| IN-A8 | The cluster id is the first incoming member id. Python hashes the sorted member ids. | `reconcile.ts:125` | Use the sorted-ids hash. | Permuting the input gives the same cluster id, equal to the Python value on a shared fixture. |
| IN-A9 | Stock-photo detection counts sellers per site. Python counts across the whole set. | `reconcile.ts:108` | One evidence contract and shared fixtures. | 3 sellers on ebay and 3 on mercari with one photo hash (threshold 5): both runtimes call it stock. |
| IN-A10 | The TS dedupe has no blocked-pair constraint, so rejected pairs can rejoin. | `reconcile.ts:121` | Honor the same persistent blocked pairs as `cluster.py`. | Pair (a, b) is blocked and shares a photo hash: they stay in two clusters in both runtimes. |
| IN-A11 | Tokenizing is ASCII lowercase and split. Python uses Unicode casefold. Non-ASCII titles score differently. | `reconcile.ts:87` | Share one normalization (casefold, `\w+`). | "Café Tasse" and "CAFÉ tasse" have text similarity 1.0 in both. |
| IN-A12 | Unclear, the code cites identity.md B5. Agreeing model ids alone are called `exact`. Python needs a score at the threshold plus GTIN or MPN, or model plus variant. | `reconcile.ts:43` | Use the identity engine's single exact-match gate in both. | Matching model id with `pair_score` 0.4: both runtimes return the same match class. |
| IN-A13 | Conditions are new, like_new, used, refurbished. Valuation uses other bands. No conversion exists. | `classify.ts:37` | One table mapping to the canonical bands before numeric engines read the slot. | `like_new` maps to the canonical top used band. An unknown value is refused, not passed. |
| IN-A14 | Contribution observations are not wired to `runPlan`, so a settled source does not update its posterior. | `learn.ts:25` | Observe on settlement and read the new target order. | After a route settles an answer, the Beta for `{kind, segment}` has one more success. The next target order changes. |
| IN-A15 | Literals instead of declared scoped params: 120 s deadline, basis 6 and 2, half-life 90, cutoff 365, saturation 3 and 0.02, gain 0.1 (`gather.ts:25`); match thresholds (`reconcile.ts:14`); regenerate 0.2, window 50, 5 pages, 3 refinements, 0.1 missing (`extract.ts:47`); 200 pages and 2 points (`learn.ts:125`). | the four lines named | Declare each prior with its spec citation and read the scoped champion. | Set `basis_n_eff` to 3 in the registry: `basisMet` is true at `n_eff` 3. Setting the exact threshold to 0.9 turns a 0.87 pair from `likely` to not matched. |

## 10. Build tasks

The paths are proposed. Tasks 1, 3, 5 and 8 run in parallel; 2 needs 1; 4 needs 2 and 3; 6 needs 2; 7 needs 2 and 5.

| # | Task | Owned files | Depends on | Proof command |
|---|---|---|---|---|
| 1 | `question_protocol` rows for every kind, with the classifier: rules, then Jev with validation | `app/src/edge/intel/protocols.ts`, `classify.ts`, `classify.test.ts` | none | `node --test app/src/edge/intel/classify.test.ts` |
| 2 | Plan and run: index first, fan-out, the hedged waterfall, single flight, priority, the stream | `app/src/edge/intel/run.ts`, `run.test.ts` | 1 | `node --test app/src/edge/intel/run.test.ts` |
| 3 | The extraction ladder and the `extractor_schema` cache | `app/src/edge/intel/extract.ts`, `extract.test.ts` | none | `node --test app/src/edge/intel/extract.test.ts` |
| 4 | Gathering more: the steps, the stopping rule, `gather.update` | `app/src/edge/intel/gather.ts`, `gather.test.ts` | 2, 3 | `node --test app/src/edge/intel/gather.test.ts` |
| 5 | Same product, keep or drop, de-duplication, reconciliation | `app/src/edge/intel/reconcile.ts`, `reconcile.test.ts` | none | `node --test app/src/edge/intel/reconcile.test.ts` |
| 6 | Learning: contribution Betas, the deadline fit, the extractor challenger | `app/src/edge/intel/learn.ts`, `learn.test.ts` | 2 | `node --test app/src/edge/intel/learn.test.ts` |
| 7 | The `listing_swarm` and `available_now` protocols, with the swarm merge | `app/src/edge/intel/swarm.ts`, `swarm.test.ts` | 2, 5 | `node --test app/src/edge/intel/swarm.test.ts` |
| 8 | The four event names in the event catalogue | `spec/events.json` | none | `node .agents/check.mjs` |

## Worked example

All numbers here are examples.

A person asks what a used wool overcoat of a known model is worth.

- **Classify.** The word "worth" matches `price_now` by rule, so there is no Jev call.
- **0.12 s.** The index holds 4 sold comps from 30 days ago and 9 asking prices from 10 minutes ago. The ask range is fresh, so it is answered; the sold comps are older than 24 h, so the sold targets stay in the plan.
- **1.4 s.** `answer.partial`: an ask range of $140 to $210, from 9 listings on 3 sites.
- **2.6 s.** The five sold reads and five active reads arrive. There are 46 results. The identity engine settles 31 of them; 15 go to Jev in 1 request, and 9 are kept. With weights, the sold set gives `n_eff` 4.2, with 2 sold in 90 days.
- **6.1 s.** Retail and price history arrive: the new price is $395.
- **10 s.** `answer.settled`. The sold range would hide as `too_few`, so a `gather_request{product, claim: sold_range, deadline: 120 s}` starts.
- **Step 1, 24 s.** Deeper result pages add 3 comps: `n_eff` 5.1.
- **Step 2, 31 s.** The adjacent condition, adjusted under D2, adds 2 comps: `n_eff` 6.3, with 3 sold in 90 days. The basis is met.
- **31 s.** `gather.update`, and the sold range of $165 to $230 appears with 14 sources.
- **Calls.** The answer cost 1 Jev request and 1 LLM call, the cached explanation. Every page ran on rungs 1 and 2.
